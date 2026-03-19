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
    context: null as null | {
      protyle: HTMLElement
      rootId: string
      title: string
    },
  }

  return {
    state,
    applyReplacementsToClone: vi.fn(),
    clearSearchDecorations: vi.fn(),
    collectSearchableBlocks: vi.fn(() => []),
    createBlockElementFromDom: vi.fn(),
    createEditorContextFromElement: vi.fn((protyle: HTMLElement | null | undefined) => {
      if (!(protyle instanceof HTMLElement)) {
        return null
      }

      return {
        protyle,
        rootId: 'root-1',
        title: 'Doc 1',
      }
    }),
    findEditorContextByRootId: vi.fn(() => state.context),
    getActiveEditorContext: vi.fn(() => state.context),
    getBlockElement: vi.fn(),
    getCurrentSelectionScope: vi.fn(() => new Map([
      ['block-1', [{ end: 3, start: 0 }]],
    ])),
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

const kernelMocks = vi.hoisted(() => ({
  getBlockDoms: vi.fn(async () => ({})),
  getDocumentContent: vi.fn(async () => ({
    blockCount: 0,
    content: '',
    eof: true,
  })),
  updateDomBlock: vi.fn(async () => null),
}))

vi.mock('@/features/search-replace/editor', () => editorMocks)
vi.mock('@/features/search-replace/search-engine', () => searchEngineMocks)
vi.mock('@/features/search-replace/kernel', () => kernelMocks)

import {
  applyPluginSettings,
  bindPlugin,
  initializeUiState,
  searchReplaceState,
  setPanelPosition,
  unbindPlugin,
} from '@/features/search-replace/store'

describe('search store ui state', () => {
  const plugin = {
    loadData: vi.fn(),
    saveData: vi.fn(async () => null),
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    document.body.innerHTML = ''
    resetState()
    editorMocks.state.context = null
  })

  afterEach(() => {
    unbindPlugin()
    window.getSelection()?.removeAllRanges()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('restores the saved panel position during initialization when remember position is enabled', async () => {
    plugin.loadData.mockResolvedValue({
      panelPosition: {
        left: 120,
        top: 64,
      },
    })

    bindPlugin(plugin as any)
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      rememberPanelPosition: true,
    })

    await initializeUiState()

    expect(plugin.loadData).toHaveBeenCalledWith('ui-state.json')
    expect(searchReplaceState.panelPosition).toEqual({
      left: 120,
      top: 64,
    })
  })

  it('persists the panel position after it changes', async () => {
    bindPlugin(plugin as any)
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      rememberPanelPosition: true,
    })

    setPanelPosition({
      left: 180,
      top: 96,
    })
    vi.runOnlyPendingTimers()

    expect(plugin.saveData).toHaveBeenCalledWith('ui-state.json', {
      panelPosition: {
        left: 180,
        top: 96,
      },
    })
  })

  it('clears the stored position immediately when remember position is disabled', async () => {
    bindPlugin(plugin as any)
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      rememberPanelPosition: true,
    })
    searchReplaceState.panelPosition = {
      left: 180,
      top: 96,
    }
    plugin.saveData.mockClear()

    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      rememberPanelPosition: false,
    })
    await Promise.resolve()

    expect(searchReplaceState.panelPosition).toBeNull()
    expect(plugin.saveData).toHaveBeenCalledWith('ui-state.json', {
      panelPosition: null,
    })
  })

  it('removes document listeners when the plugin is unbound', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div contenteditable="true">foo bar</div>
      </div>
    `

    const protyle = document.querySelector('.protyle') as HTMLElement
    const textNode = document.querySelector('[contenteditable="true"]')?.firstChild as Text
    const selection = window.getSelection()!
    const range = document.createRange()
    range.setStart(textNode, 0)
    range.setEnd(textNode, 3)
    selection.removeAllRanges()
    selection.addRange(range)

    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }

    bindPlugin(plugin as any)
    document.dispatchEvent(new Event('selectionchange'))

    expect(editorMocks.getCurrentSelectionScope).toHaveBeenCalledTimes(1)

    editorMocks.getCurrentSelectionScope.mockClear()
    unbindPlugin()
    document.dispatchEvent(new Event('selectionchange'))

    expect(editorMocks.getCurrentSelectionScope).not.toHaveBeenCalled()
  })

  it('falls back silently when stored panel position cannot be loaded', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    plugin.loadData.mockRejectedValue(new Error('boom'))

    bindPlugin(plugin as any)
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      rememberPanelPosition: true,
    })

    await initializeUiState()

    expect(searchReplaceState.panelPosition).toBeNull()
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

function resetState() {
  searchReplaceState.visible = false
  searchReplaceState.replaceVisible = DEFAULT_SETTINGS.defaultReplaceVisible
  searchReplaceState.minimapVisible = false
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
