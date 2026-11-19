import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  clearGlobalSearchResults,
  executeGlobalSearch,
  globalSearchState,
  setGlobalQuery,
} from '@/features/search-replace/global/store'

const { executeGlobalBlockQuery } = vi.hoisted(() => ({
  executeGlobalBlockQuery: vi.fn(),
}))

vi.mock('@/features/search-replace/global/kernel-query', () => ({
  executeGlobalBlockQuery,
}))

function docRecord(id: string, content: string) {
  return {
    id,
    root_id: `root-${id}`,
    box: 'box-1',
    hpath: `/${id}`,
    content,
    fcontent: content,
    markdown: content,
    type: 'p',
    sort: 0,
    created: '20261119000000',
    updated: '20261119000000',
  }
}

describe('global search revision guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalSearchState.query = ''
    globalSearchState.searchedQuery = ''
    globalSearchState.searching = false
    globalSearchState.error = undefined
    // 用非文档块记录驱动聚合器，关闭"仅文档"过滤
    globalSearchState.options.docOnly = false
    clearGlobalSearchResults()
  })

  it('keeps the newest search results when an older search finishes later', async () => {
    let resolveStale!: (records: unknown[]) => void
    executeGlobalBlockQuery.mockImplementationOnce(() => new Promise((resolve) => {
      resolveStale = resolve
    }))
    executeGlobalBlockQuery.mockImplementationOnce(async () => [docRecord('fresh', 'hello fresh world')])

    globalSearchState.query = 'hello'
    const staleSearch = executeGlobalSearch()
    const freshSearch = executeGlobalSearch()
    await freshSearch

    expect(globalSearchState.results.map((doc) => doc.rootId)).toEqual(['root-fresh'])

    // 旧搜索此刻才完成：其结果必须被丢弃，不得覆盖新结果
    resolveStale([docRecord('stale', 'hello stale world')])
    await staleSearch

    expect(globalSearchState.results.map((doc) => doc.rootId)).toEqual(['root-fresh'])
    expect(globalSearchState.searchedQuery).toBe('hello')
    expect(globalSearchState.error).toBeUndefined()
  })

  it('keeps spinner active while a newer overlapping search is still running', async () => {
    let resolveOld!: (records: unknown[]) => void
    executeGlobalBlockQuery.mockImplementationOnce(() => new Promise((resolve) => {
      resolveOld = resolve
    }))
    let resolveNew!: (records: unknown[]) => void
    executeGlobalBlockQuery.mockImplementationOnce(() => new Promise((resolve) => {
      resolveNew = resolve
    }))

    globalSearchState.query = 'hello'
    const oldSearch = executeGlobalSearch()
    const newSearch = executeGlobalSearch()
    expect(globalSearchState.searching).toBe(true)

    // 旧搜索先完成：新搜索仍在运行，spinner 不得被关闭
    resolveOld([docRecord('old', 'hello old')])
    await oldSearch
    expect(globalSearchState.searching).toBe(true)

    resolveNew([docRecord('new', 'hello new')])
    await newSearch
    expect(globalSearchState.searching).toBe(false)
    expect(globalSearchState.results.map((doc) => doc.rootId)).toEqual(['root-new'])
  })

  it('discards in-flight search results after the query changes', async () => {
    let resolveSearch!: (records: unknown[]) => void
    executeGlobalBlockQuery.mockImplementationOnce(() => new Promise((resolve) => {
      resolveSearch = resolve
    }))

    globalSearchState.query = 'hello'
    const pending = executeGlobalSearch()

    // 修改查询触发结果清空，同时使 in-flight 搜索的 revision 过期
    setGlobalQuery('changed')
    resolveSearch([docRecord('stale', 'hello stale world')])
    await pending

    expect(globalSearchState.results).toEqual([])
    expect(globalSearchState.searchedQuery).toBe('')
    expect(globalSearchState.searching).toBe(false)
  })

  it('resets searching state even when the stale search throws', async () => {
    let rejectStale!: (error: Error) => void
    executeGlobalBlockQuery.mockImplementationOnce(() => new Promise((_resolve, reject) => {
      rejectStale = reject
    }))
    executeGlobalBlockQuery.mockImplementationOnce(async () => [docRecord('fresh', 'hello fresh')])

    globalSearchState.query = 'hello'
    const staleSearch = executeGlobalSearch()
    const freshSearch = executeGlobalSearch()
    await freshSearch

    rejectStale(new Error('kernel unavailable'))
    await staleSearch

    expect(globalSearchState.searching).toBe(false)
    expect(globalSearchState.error).toBeUndefined()
    expect(globalSearchState.results.map((doc) => doc.rootId)).toEqual(['root-fresh'])
  })
})
