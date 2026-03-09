// @vitest-environment jsdom

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const loadSettings = vi.fn().mockResolvedValue({
  debugLog: false,
  defaultReplaceVisible: false,
  includeCodeBlock: false,
  minimapVisible: false,
  panelHotkey: 'Ctrl+F11',
  preserveCase: false,
  preloadSelection: true,
  rememberPanelPosition: true,
  replacePanelHotkey: 'Ctrl+F12',
})

const onEditorContextChanged = vi.fn()
const openPanel = vi.fn()
const createEditorContextFromProtyleLike = vi.fn((protyle) => ({
  protyle: protyle.element,
  rootId: protyle.block.rootID,
  title: 'Doc 1',
}))

vi.mock('@/main', () => ({
  destroy: vi.fn(),
  init: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/features/search-replace/store', () => ({
  applyPluginSettings: vi.fn(),
  onEditorContextChanged,
  openPanel,
}))

vi.mock('@/features/search-replace/editor', () => ({
  createEditorContextFromProtyleLike,
}))

vi.mock('@/settings', () => ({
  DEFAULT_SETTINGS: {
    debugLog: false,
    defaultReplaceVisible: false,
    includeCodeBlock: false,
    minimapVisible: false,
    panelHotkey: 'Ctrl+F11',
    preserveCase: false,
    preloadSelection: true,
    rememberPanelPosition: true,
    replacePanelHotkey: 'Ctrl+F12',
  },
  loadSettings,
  normalizeSettings: vi.fn(value => value),
  saveSettings: vi.fn(),
}))

describe('plugin command hotkeys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('registers panel commands with SiYuan command hotkey symbols', async () => {
    const { default: FriendlySearchReplacePlugin } = await import('@/index')

    const plugin = new FriendlySearchReplacePlugin()
    plugin.i18n = {
      addTopBarIcon: 'Friendly Search Replace',
    }

    await plugin.onload()

    expect(plugin.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({
        langKey: 'togglePanel',
        hotkey: '⌘F11',
        customHotkey: '⌘F11',
      }),
      expect.objectContaining({
        langKey: 'toggleReplacePanel',
        hotkey: '⌘F12',
        customHotkey: '⌘F12',
      }),
    ]))
  })

  it('registers an editor callback that opens the panel with the current protyle context', async () => {
    const { default: FriendlySearchReplacePlugin } = await import('@/index')

    const plugin = new FriendlySearchReplacePlugin()
    plugin.i18n = {
      addTopBarIcon: 'Friendly Search Replace',
    }

    await plugin.onload()

    const panelCommand = plugin.commands.find(command => command.langKey === 'togglePanel')
    const protyle = {
      block: {
        rootID: 'root-1',
      },
      element: document.createElement('div'),
    }

    panelCommand?.editorCallback?.(protyle)

    expect(createEditorContextFromProtyleLike).toHaveBeenCalledWith(protyle)
    expect(onEditorContextChanged).toHaveBeenCalledWith(expect.objectContaining({
      rootId: 'root-1',
      title: 'Doc 1',
    }))
    expect(openPanel).toHaveBeenCalledWith(true, undefined)
  })
})
