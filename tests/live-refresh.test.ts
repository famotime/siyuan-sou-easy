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
    blocks: [] as Array<{
      blockId: string
      blockIndex: number
      blockType: string
      element: HTMLElement
      rootId: string
      text: string
    }>,
    context: null as null | {
      protyle: HTMLElement
      rootId: string
      title: string
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
    getCurrentSelectionScope: vi.fn(() => new Map()),
    getCurrentSelectionText: vi.fn(() => ''),
    scrollMatchIntoView: vi.fn(),
    syncSearchDecorations: vi.fn(),
  }
})

const searchEngineMocks = vi.hoisted(() => ({
  findMatches: vi.fn(() => ({
    error: '',
    matches: [],
  })),
}))

vi.mock('@/features/search-replace/editor', () => editorMocks)
vi.mock('@/features/search-replace/search-engine', () => searchEngineMocks)

import {
  applyPluginSettings,
  closePanel,
  openPanel,
  searchReplaceState,
} from '@/features/search-replace/store'

describe('search store live refresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    document.body.innerHTML = ''

    const protyle = document.createElement('div')
    protyle.className = 'protyle'

    const wysiwyg = document.createElement('div')
    wysiwyg.className = 'protyle-wysiwyg'
    protyle.appendChild(wysiwyg)
    document.body.appendChild(protyle)

    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.state.contextAvailable = true
    editorMocks.state.blocks = [{
      blockId: 'block-1',
      blockIndex: 0,
      blockType: 'NodeParagraph',
      element: wysiwyg,
      rootId: 'root-1',
      text: 'bar baz',
    }]

    resetState()
  })

  afterEach(() => {
    closePanel()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('refreshes matches when the current document DOM changes', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })
    searchReplaceState.query = 'foo'

    searchEngineMocks.findMatches
      .mockImplementationOnce(() => ({
        error: '',
        matches: [],
      }))
      .mockImplementationOnce(() => ({
        error: '',
        matches: [{
          blockId: 'block-1',
          blockIndex: 0,
          blockType: 'NodeParagraph',
          end: 3,
          id: 'block-1:0:3',
          matchedText: 'foo',
          previewText: '[foo] bar',
          replaceable: true,
          rootId: 'root-1',
          start: 0,
        }],
      }))

    openPanel(true)
    vi.runOnlyPendingTimers()

    expect(searchReplaceState.matches).toHaveLength(0)
    expect(searchEngineMocks.findMatches).toHaveBeenCalledTimes(1)

    editorMocks.state.blocks = [{
      blockId: 'block-1',
      blockIndex: 0,
      blockType: 'NodeParagraph',
      element: editorMocks.state.context!.protyle.querySelector('.protyle-wysiwyg') as HTMLElement,
      rootId: 'root-1',
      text: 'foo bar',
    }]

    const changedNode = document.createElement('div')
    changedNode.textContent = 'foo bar'
    editorMocks.state.context!.protyle.querySelector('.protyle-wysiwyg')?.appendChild(changedNode)

    await Promise.resolve()
    vi.runOnlyPendingTimers()

    expect(searchEngineMocks.findMatches).toHaveBeenCalledTimes(2)
    expect(searchReplaceState.matches).toHaveLength(1)
  })
})

function resetState() {
  searchReplaceState.visible = false
  searchReplaceState.replaceVisible = DEFAULT_SETTINGS.defaultReplaceVisible
  ;(searchReplaceState as any).minimapVisible = false
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
