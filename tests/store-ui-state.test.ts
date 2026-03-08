// @vitest-environment jsdom

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import type { Plugin } from 'siyuan'
import { DEFAULT_SETTINGS, createSearchOptionsFromSettings } from '@/settings'

const editorMocks = vi.hoisted(() => {
  const state = {
    context: {
      protyle: document.createElement('div'),
      rootId: 'root-1',
      title: 'Doc 1',
    },
  }

  return {
    state,
    applyReplacementsToClone: vi.fn(),
    clearSearchDecorations: vi.fn(),
    collectSearchableBlocks: vi.fn(() => []),
    createEditorContextFromElement: vi.fn(() => state.context),
    findEditorContextByRootId: vi.fn(() => state.context),
    getActiveEditorContext: vi.fn(() => state.context),
    getBlockElement: vi.fn(),
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
  updateDomBlock: vi.fn(async () => null),
}))

vi.mock('@/features/search-replace/editor', () => editorMocks)
vi.mock('@/features/search-replace/search-engine', () => searchEngineMocks)
vi.mock('@/features/search-replace/kernel', () => kernelMocks)

import {
  applyPluginSettings,
  bindPlugin,
  closePanel,
  initializeUiState,
  persistPanelPosition,
  searchReplaceState,
  setPanelPosition,
  unbindPlugin,
} from '@/features/search-replace/store'

describe('search store ui state', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    document.body.innerHTML = ''

    const protyle = document.createElement('div')
    protyle.className = 'protyle'
    document.body.appendChild(protyle)
    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }

    resetState()
  })

  afterEach(() => {
    closePanel()
    unbindPlugin()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('loads the stored panel position only when rememberPanelPosition is enabled', async () => {
    const plugin = createPluginMock({
      panelPosition: { left: 12, top: 34 },
    })

    bindPlugin(plugin)
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      rememberPanelPosition: true,
    })

    await initializeUiState()

    expect(searchReplaceState.panelPosition).toEqual({ left: 12, top: 34 })

    unbindPlugin()
    resetState()

    const ignoredPlugin = createPluginMock({
      panelPosition: { left: 56, top: 78 },
    })

    bindPlugin(ignoredPlugin)
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      rememberPanelPosition: false,
    })

    await initializeUiState()

    expect(searchReplaceState.panelPosition).toBeNull()
  })

  it('persists the panel position and clears stored state when rememberPanelPosition is turned off', async () => {
    const plugin = createPluginMock(null)

    bindPlugin(plugin)
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      rememberPanelPosition: true,
    })

    setPanelPosition({ left: 80, top: 120 })
    vi.runOnlyPendingTimers()
    await Promise.resolve()

    expect(plugin.saveData).toHaveBeenCalledWith('ui-state.json', {
      panelPosition: { left: 80, top: 120 },
    })

    plugin.saveData.mockClear()

    persistPanelPosition()
    vi.runOnlyPendingTimers()
    await Promise.resolve()

    expect(plugin.saveData).toHaveBeenCalledWith('ui-state.json', {
      panelPosition: { left: 80, top: 120 },
    })

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
})

function createPluginMock(loadResult: unknown) {
  return {
    loadData: vi.fn(async () => loadResult),
    saveData: vi.fn(async () => null),
  } as unknown as Plugin & {
    loadData: ReturnType<typeof vi.fn>
    saveData: ReturnType<typeof vi.fn>
  }
}

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
