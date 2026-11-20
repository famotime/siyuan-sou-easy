// @vitest-environment node

import {
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  collapseAllDocs,
  expandAllDocs,
  globalSearchState,
  resetGlobalSearchState,
  setGlobalQuery,
  setGlobalSortMode,
  toggleDocCollapse,
  toggleGlobalOption,
} from '@/features/search-replace/global/store'

describe('global-search store', () => {
  // RF-106：状态工厂重置取代直接的模块级状态泄漏，用例间互不影响
  beforeEach(() => {
    resetGlobalSearchState()
  })

  it('updates query and toggles options', () => {
    setGlobalQuery('测试关键词')
    expect(globalSearchState.query).toBe('测试关键词')

    expect(globalSearchState.options.matchCase).toBe(false)
    toggleGlobalOption('matchCase')
    expect(globalSearchState.options.matchCase).toBe(true)
  })

  it('toggles doc collapse and expand all', () => {
    globalSearchState.results = [
      {
        rootId: 'd1',
        boxId: 'b1',
        hpath: '/d1',
        docTitle: 'Doc 1',
        updated: '20261005120000',
        created: '20261005120000',
        matches: [],
        collapsed: false,
        totalCount: 0,
      },
      {
        rootId: 'd2',
        boxId: 'b1',
        hpath: '/d2',
        docTitle: 'Doc 2',
        updated: '20261005120000',
        created: '20261005120000',
        matches: [],
        collapsed: false,
        totalCount: 0,
      },
    ]

    toggleDocCollapse('d1')
    expect(globalSearchState.results[0].collapsed).toBe(true)
    expect(globalSearchState.results[1].collapsed).toBe(false)

    collapseAllDocs()
    expect(globalSearchState.results[0].collapsed).toBe(true)
    expect(globalSearchState.results[1].collapsed).toBe(true)

    expandAllDocs()
    expect(globalSearchState.results[0].collapsed).toBe(false)
    expect(globalSearchState.results[1].collapsed).toBe(false)
  })

  it('updates sort mode', () => {
    setGlobalSortMode('updatedDesc')
    expect(globalSearchState.sortMode).toBe('updatedDesc')
  })

  it('toggles pinyin option correctly', () => {
    const initial = globalSearchState.options.pinyin
    toggleGlobalOption('pinyin')
    expect(globalSearchState.options.pinyin).toBe(!initial)
    toggleGlobalOption('pinyin')
    expect(globalSearchState.options.pinyin).toBe(initial)
  })
})
