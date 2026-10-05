import { describe, expect, it } from 'vitest'
import {
  closeGlobalSearch,
  collapseAllDocs,
  expandAllDocs,
  globalSearchState,
  openGlobalSearch,
  setGlobalQuery,
  setGlobalSortMode,
  toggleDocCollapse,
  toggleDocSelection,
  toggleGlobalOption,
  toggleMatchSelection,
} from '@/features/search-replace/global/store'

describe('global-search store', () => {
  it('opens and closes global search workbench', () => {
    openGlobalSearch(false)
    expect(globalSearchState.visible).toBe(true)
    expect(globalSearchState.replaceVisible).toBe(false)

    openGlobalSearch(true)
    expect(globalSearchState.replaceVisible).toBe(true)

    closeGlobalSearch()
    expect(globalSearchState.visible).toBe(false)
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

  it('toggles match selection for replace', () => {
    globalSearchState.results = [
      {
        rootId: 'd1',
        boxId: 'b1',
        hpath: '/d1',
        docTitle: 'Doc 1',
        updated: '20261005120000',
        created: '20261005120000',
        matches: [
          {
            matchId: 'm1',
            blockId: 'b1',
            rootId: 'd1',
            blockType: 'p',
            matchedText: 'foo',
            prefixText: '',
            suffixText: '',
            previewText: 'foo',
            segments: [],
            fullContent: 'foo',
            sort: 0,
            updated: '',
            created: '',
            hpath: '',
            box: '',
            selectedForReplace: true,
            startOffset: 0,
            endOffset: 3,
          },
        ],
        collapsed: false,
        totalCount: 1,
      },
    ]

    toggleMatchSelection('m1')
    expect(globalSearchState.results[0].matches[0].selectedForReplace).toBe(false)

    toggleDocSelection('d1')
    expect(globalSearchState.results[0].matches[0].selectedForReplace).toBe(true)
  })

  it('updates sort mode', () => {
    setGlobalSortMode('updatedDesc')
    expect(globalSearchState.sortMode).toBe('updatedDesc')
  })
})
