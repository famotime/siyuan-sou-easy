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
      protyle: { isConnected: true } as HTMLElement,
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
    findEditorContextByRootId: vi.fn(() => (state.contextAvailable ? state.context : null)),
    getActiveEditorContext: vi.fn(() => (state.contextAvailable ? state.context : null)),
    getBlockElement: vi.fn(),
    getCurrentSelectionText: vi.fn(() => ''),
    scrollMatchIntoView: vi.fn(),
    syncSearchDecorations: vi.fn(),
  }
})

const searchEngineMocks = vi.hoisted(() => ({
  findMatches: vi.fn(() => ({
    error: '',
    matches: [
      {
        blockId: 'block-1',
        blockIndex: 0,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-1:0:3',
        matchedText: 'foo',
        previewText: '[foo] bar foo',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
      },
      {
        blockId: 'block-1',
        blockIndex: 0,
        blockType: 'NodeParagraph',
        end: 11,
        id: 'block-1:8:11',
        matchedText: 'foo',
        previewText: 'foo bar [foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 8,
      },
    ],
  })),
}))

vi.mock('@/features/search-replace/editor', () => editorMocks)
vi.mock('@/features/search-replace/search-engine', () => searchEngineMocks)

import {
  applyPluginSettings,
  closePanel,
  goNext,
  onEditorContextChanged,
  openPanel,
  searchReplaceState,
} from '@/features/search-replace/store'

describe('search store editor context fallback', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetState()
    editorMocks.state.contextAvailable = true
    vi.clearAllMocks()
  })

  afterEach(() => {
    closePanel()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('keeps searching after the panel steals focus from the editor', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })
    searchReplaceState.query = 'foo'

    openPanel(true)
    queueMicrotask(() => {
      editorMocks.state.contextAvailable = false
    })

    await Promise.resolve()
    vi.runOnlyPendingTimers()

    expect(searchReplaceState.currentRootId).toBe('root-1')
    expect(searchReplaceState.currentTitle).toBe('Doc 1')
    expect(searchReplaceState.error).toBe('')
    expect(searchReplaceState.matches).toHaveLength(2)
  })

  it('keeps revealing matches when navigation runs from the panel', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })
    searchReplaceState.query = 'foo'

    openPanel(true)
    vi.runOnlyPendingTimers()

    expect(searchReplaceState.matches).toHaveLength(2)

    editorMocks.state.contextAvailable = false
    editorMocks.scrollMatchIntoView.mockClear()
    editorMocks.syncSearchDecorations.mockClear()

    goNext()

    expect(searchReplaceState.currentIndex).toBe(1)
    expect(editorMocks.syncSearchDecorations).toHaveBeenCalledTimes(1)
    expect(editorMocks.scrollMatchIntoView).toHaveBeenCalledTimes(1)
  })

  it('can search immediately after opening when editor context was cached before the panel became visible', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })
    searchReplaceState.query = 'foo'
    editorMocks.state.contextAvailable = false

    onEditorContextChanged(editorMocks.state.context)
    openPanel(true)
    vi.runOnlyPendingTimers()

    expect(searchReplaceState.currentRootId).toBe('root-1')
    expect(searchReplaceState.currentTitle).toBe('Doc 1')
    expect(searchReplaceState.error).toBe('')
    expect(searchReplaceState.matches).toHaveLength(2)
  })

  it('does not overwrite a cached editor event context with a stale detected context when opening the panel', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })

    const currentContext = {
      protyle: { isConnected: true } as HTMLElement,
      rootId: 'root-current',
      title: 'Current Doc',
    }
    const staleContext = {
      protyle: { isConnected: true } as HTMLElement,
      rootId: 'root-stale',
      title: 'Stale Doc',
    }

    editorMocks.collectSearchableBlocks.mockImplementation((context) => {
      if (context.rootId === currentContext.rootId) {
        return [{
          blockId: 'block-current',
          blockIndex: 0,
          blockType: 'NodeParagraph',
          element: {} as HTMLElement,
          rootId: currentContext.rootId,
          text: '问题问题',
        }]
      }

      return [{
        blockId: 'block-stale',
        blockIndex: 0,
        blockType: 'NodeParagraph',
        element: {} as HTMLElement,
        rootId: staleContext.rootId,
        text: 'other text',
      }]
    })
    searchEngineMocks.findMatches.mockImplementation((blocks) => ({
      error: '',
      matches: blocks[0]?.rootId === currentContext.rootId
        ? [{
          blockId: 'block-current',
          blockIndex: 0,
          blockType: 'NodeParagraph',
          end: 2,
          id: 'block-current:0:2',
          matchedText: '问题',
          previewText: '[问题]问题',
          replaceable: true,
          rootId: currentContext.rootId,
          start: 0,
        }]
        : [],
    }))

    searchReplaceState.query = '问题'
    editorMocks.state.context = staleContext

    onEditorContextChanged(currentContext)
    openPanel(true)
    vi.runOnlyPendingTimers()

    expect(searchReplaceState.currentRootId).toBe(currentContext.rootId)
    expect(searchReplaceState.currentTitle).toBe(currentContext.title)
    expect(searchReplaceState.matches).toHaveLength(1)
    expect(searchReplaceState.matches[0]?.rootId).toBe(currentContext.rootId)
  })
})

function resetState() {
  searchReplaceState.visible = false
  searchReplaceState.replaceVisible = DEFAULT_SETTINGS.defaultReplaceVisible
  searchReplaceState.panelPosition = null
  searchReplaceState.settings = { ...DEFAULT_SETTINGS }
  searchReplaceState.query = ''
  searchReplaceState.replacement = ''
  searchReplaceState.options = createSearchOptionsFromSettings(DEFAULT_SETTINGS)
  searchReplaceState.currentRootId = ''
  searchReplaceState.currentTitle = ''
  searchReplaceState.matches = []
  searchReplaceState.currentIndex = 0
  searchReplaceState.error = ''
  searchReplaceState.busy = false
}
