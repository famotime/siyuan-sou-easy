import { beforeEach, describe, expect, it, vi } from 'vitest'

const { executeGlobalBlockQuery } = vi.hoisted(() => ({
  executeGlobalBlockQuery: vi.fn(),
}))

vi.mock('@/features/search-replace/global/kernel-query', () => ({
  executeGlobalBlockQuery,
}))

import {
  clearGlobalSearchResults,
  executeGlobalSearch,
  globalSearchState,
  setGlobalQuery,
} from '@/features/search-replace/global/store'
import type { GlobalSearchFilters } from '@/features/search-replace/global/types'

describe('global search docOnly/type-filter interplay and date filter mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalSearchState.query = ''
    globalSearchState.searchedQuery = ''
    globalSearchState.searching = false
    globalSearchState.error = undefined
    globalSearchState.options.docOnly = true
    globalSearchState.filters = {}
    globalSearchState.sortMode = 'relevance'
    clearGlobalSearchResults()
    executeGlobalBlockQuery.mockResolvedValue([])
  })

  it('keeps docOnly enabled when no type filter is present', async () => {
    setGlobalQuery('思源笔记')
    await executeGlobalSearch()

    const filters = executeGlobalBlockQuery.mock.calls[0][1] as GlobalSearchFilters
    const options = executeGlobalBlockQuery.mock.calls[0][2] as { docOnly: boolean }
    expect(filters.types).toEqual([])
    expect(options.docOnly).toBe(true)
  })

  it('auto-disables docOnly when type syntax is present in the query', async () => {
    setGlobalQuery('type:c 思源')
    await executeGlobalSearch()

    const filters = executeGlobalBlockQuery.mock.calls[0][1] as GlobalSearchFilters
    const options = executeGlobalBlockQuery.mock.calls[0][2] as { docOnly: boolean }
    expect(filters.types).toEqual(['c'])
    expect(options.docOnly).toBe(false)
  })

  it('auto-disables docOnly when type pills are selected in filters', async () => {
    globalSearchState.filters = { types: ['p'] }
    setGlobalQuery('思源笔记')
    await executeGlobalSearch()

    const filters = executeGlobalBlockQuery.mock.calls[0][1] as GlobalSearchFilters
    const options = executeGlobalBlockQuery.mock.calls[0][2] as { docOnly: boolean }
    expect(filters.types).toEqual(['p'])
    expect(options.docOnly).toBe(false)
  })

  it('maps updated: query syntax into the SQL date range', async () => {
    setGlobalQuery('updated:2026-10-01 思源')
    await executeGlobalSearch()

    const filters = executeGlobalBlockQuery.mock.calls[0][1] as GlobalSearchFilters
    expect(filters.dateRange).toEqual({ start: '20261001000000' })
  })

  it('lets query date syntax override the pill date range', async () => {
    globalSearchState.filters = { dateRange: { start: '20260901000000' } }
    setGlobalQuery('updated:3d 思源')
    await executeGlobalSearch()

    const filters = executeGlobalBlockQuery.mock.calls[0][1] as GlobalSearchFilters
    // 3d 的具体时刻依赖当前时钟，只验证它覆盖了胶囊值且为合法的时间戳
    expect(filters.dateRange?.start).toMatch(/^\d{14}$/)
    expect(filters.dateRange?.start).not.toBe('20260901000000')
    expect(filters.dateRange?.end).toBeUndefined()
  })
})
