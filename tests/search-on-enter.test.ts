// @vitest-environment jsdom

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { DEFAULT_SETTINGS, createSearchOptionsFromSettings } from '@/settings'

const editorMocks = vi.hoisted(() => {
  const state = {
    blocks: [{
      blockId: 'block-1',
      blockIndex: 0,
      blockType: 'NodeParagraph',
      element: {} as HTMLElement,
      rootId: 'root-1',
      text: 'foo bar foo',
    }],
    context: {
      protyle: document.createElement('div'),
      rootId: 'root-1',
      title: 'Doc 1',
    },
    contextAvailable: true,
  }

  return {
    state,
    applyReplacementsToClone: vi.fn(),
    clearSearchDecorations: vi.fn(),
    collectSearchableBlocks: vi.fn(() => state.blocks),
    collectSearchableBlocksFromDocumentContent: vi.fn(() => state.blocks),
    createBlockElementFromDom: vi.fn((dom: string) => {
      const container = document.createElement('div')
      container.innerHTML = dom
      return container.firstElementChild as HTMLElement | null
    }),
    createEditorContextFromElement: vi.fn(() => state.context),
    findEditorContextByRootId: vi.fn(() => (state.contextAvailable ? state.context : null)),
    getActiveEditorContext: vi.fn(() => (state.contextAvailable ? state.context : null)),
    getBlockElement: vi.fn(),
    getCurrentSelectionScope: vi.fn(() => new Map()),
    getCurrentSelectionText: vi.fn(() => ''),
    isMatchVisible: vi.fn(() => true),
    scrollMatchIntoView: vi.fn(),
    syncSearchDecorations: vi.fn(),
  }
})

const searchEngineMocks = vi.hoisted(() => ({
  findMatches: vi.fn((_blocks: any, query: string) => ({
    error: '',
    matches: query ? [
      {
        blockId: 'block-1',
        end: 3,
        id: 'm1',
        matchedText: query,
        occ: 0,
        start: 0,
      },
    ] : [],
  })),
}))

const kernelMocks = vi.hoisted(() => ({
  getBlockAttrs: vi.fn(async () => ({})),
  getBlockDoms: vi.fn(async () => ({})),
  getDocumentContent: vi.fn(async () => ({
    blockCount: 0,
    content: '',
    eof: true,
  })),
  querySql: vi.fn(async () => []),
  updateDomBlock: vi.fn(async () => null),
}))

vi.mock('@/features/search-replace/editor', () => editorMocks)
vi.mock('@/features/search-replace/search-engine', () => searchEngineMocks)
vi.mock('@/features/search-replace/kernel', () => kernelMocks)

describe('searchOnEnter behavior', () => {
  let store: typeof import('@/features/search-replace/store')

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.resetModules()
    document.body.innerHTML = ''

    const protyle = document.createElement('div')
    protyle.className = 'protyle'
    document.body.appendChild(protyle)
    editorMocks.state.context.protyle = protyle
    editorMocks.getCurrentSelectionText.mockReturnValue('')

    store = await import('@/features/search-replace/store')
    store.applyPluginSettings({
      ...DEFAULT_SETTINGS,
      searchOnEnter: true,
    })
    store.openPanel(true)
  })

  afterEach(() => {
    store.closePanel()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('does not trigger search as user types and clears draft matches', () => {
    store.setQuery('f')
    vi.advanceTimersByTime(200)

    expect(searchEngineMocks.findMatches).not.toHaveBeenCalled()
    expect(store.searchReplaceState.matches).toHaveLength(0)
    expect(editorMocks.clearSearchDecorations).toHaveBeenCalled()

    store.setQuery('foo')
    vi.advanceTimersByTime(200)

    expect(searchEngineMocks.findMatches).not.toHaveBeenCalled()
    expect(store.searchReplaceState.matches).toHaveLength(0)
  })

  it('triggers search when commitQueryAndSearch is called', async () => {
    store.setQuery('foo')
    expect(searchEngineMocks.findMatches).not.toHaveBeenCalled()

    store.commitQueryAndSearch()
    await vi.runAllTimersAsync()

    expect(searchEngineMocks.findMatches).toHaveBeenCalledWith(
      expect.anything(),
      'foo',
      expect.anything(),
      expect.anything(),
    )
    expect(store.searchReplaceState.committedQuery).toBe('foo')
    expect(store.searchReplaceState.matches).toHaveLength(1)
  })

  it('clears matches immediately if query changes after a committed search', async () => {
    store.commitQueryAndSearch('foo')
    await vi.runAllTimersAsync()
    expect(store.searchReplaceState.matches).toHaveLength(1)

    // User edits query to 'foob'
    store.setQuery('foob')
    expect(store.searchReplaceState.matches).toHaveLength(0)
    expect(editorMocks.clearSearchDecorations).toHaveBeenCalled()
  })

  it('resets committedQuery and draft state when query is cleared', async () => {
    store.commitQueryAndSearch('foo')
    await vi.runAllTimersAsync()
    expect(store.searchReplaceState.committedQuery).toBe('foo')

    store.setQuery('')
    expect(store.searchReplaceState.committedQuery).toBe('')
    expect(store.searchReplaceState.matches).toHaveLength(0)
  })

  it('only refreshes search on option toggle when query was already committed', async () => {
    // 1. Uncommitted typing: toggle option should NOT trigger search
    store.setQuery('foo')
    searchEngineMocks.findMatches.mockClear()
    store.toggleOption('matchCase')
    await vi.runAllTimersAsync()
    expect(searchEngineMocks.findMatches).not.toHaveBeenCalled()

    // 2. Commit search
    store.commitQueryAndSearch()
    await vi.runAllTimersAsync()
    expect(searchEngineMocks.findMatches).toHaveBeenCalled()

    // 3. Now toggle option with committed query: should refresh immediately
    searchEngineMocks.findMatches.mockClear()
    store.toggleOption('matchCase')
    await vi.runAllTimersAsync()
    expect(searchEngineMocks.findMatches).toHaveBeenCalled()
  })

  it('automatically triggers search if preloaded selection is present when opening panel', async () => {
    editorMocks.getCurrentSelectionText.mockReturnValue('preloaded text')

    store.closePanel()
    store.openPanel(true)
    await vi.runAllTimersAsync()

    expect(store.searchReplaceState.query).toBe('preloaded text')
    expect(store.searchReplaceState.committedQuery).toBe('preloaded text')
    expect(searchEngineMocks.findMatches).toHaveBeenCalledWith(
      expect.anything(),
      'preloaded text',
      expect.anything(),
      expect.anything(),
    )
  })

  it('navigates next and prev on subsequent navigation actions once committed', async () => {
    searchEngineMocks.findMatches.mockReturnValue({
      error: '',
      matches: [
        { blockId: 'block-1', end: 3, id: 'm1', matchedText: 'foo', occ: 0, start: 0 },
        { blockId: 'block-1', end: 11, id: 'm2', matchedText: 'foo', occ: 0, start: 8 },
      ],
    })

    store.commitQueryAndSearch('foo')
    await vi.runAllTimersAsync()
    expect(store.searchReplaceState.currentIndex).toBe(0)

    store.goNext()
    expect(store.searchReplaceState.currentIndex).toBe(1)

    store.goPrev()
    expect(store.searchReplaceState.currentIndex).toBe(0)
  })

  it('handles terminal mode with searchOnEnter', () => {
    const surface = {
      clear: vi.fn(),
      focus: vi.fn(),
      goTo: vi.fn(),
      id: 'terminal-1',
      search: vi.fn(() => ({
        currentIndex: 0,
        error: '',
        matches: [
          {
            col: 0,
            id: '0:0:4',
            length: 4,
            matchedText: 'term',
            previewText: '[term]',
            row: 0,
          },
        ],
      })),
      title: 'Terminal',
    }
    store.openTerminalPanel(surface as any, false)

    store.setQuery('term')
    expect(surface.search).not.toHaveBeenCalled()
    expect(store.searchReplaceState.matches).toHaveLength(0)

    store.commitQueryAndSearch()
    expect(surface.search).toHaveBeenCalledWith(expect.objectContaining({
      matchCase: false,
      query: 'term',
    }))
    expect(store.searchReplaceState.committedQuery).toBe('term')
    expect(store.searchReplaceState.matches).toHaveLength(1)
  })
})
