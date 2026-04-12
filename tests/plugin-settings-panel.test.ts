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
  largeCodeBlockLineThreshold: 1000,
  minimapVisible: false,
  optimizeLargeCodeBlocks: true,
  panelHotkey: 'Ctrl+F11',
  preloadSelection: true,
  preserveCase: false,
  rememberPanelPosition: true,
  replacePanelHotkey: 'Ctrl+F12',
  searchAttributeView: false,
})

vi.mock('@/main', () => ({
  destroy: vi.fn(),
  init: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/features/search-replace/store', () => ({
  applyPluginSettings: vi.fn(),
  onEditorContextChanged: vi.fn(),
  openPanel: vi.fn(),
}))

vi.mock('@/settings', () => ({
  DEFAULT_SETTINGS: {
    debugLog: false,
    defaultReplaceVisible: false,
    includeCodeBlock: false,
    largeCodeBlockLineThreshold: 1000,
    minimapVisible: false,
    optimizeLargeCodeBlocks: true,
    panelHotkey: 'Ctrl+F11',
    preloadSelection: true,
    preserveCase: false,
    rememberPanelPosition: true,
    replacePanelHotkey: 'Ctrl+F12',
    searchAttributeView: false,
  },
  SETTINGS_STORAGE: 'settings.json',
  loadSettings,
  normalizeSettings: vi.fn(value => value),
  saveSettings: vi.fn(),
}))

const settingsI18n = {
  settingDebugLogDesc: 'debug',
  settingDebugLogTitle: 'Debug',
  settingDefaultReplaceVisibleDesc: 'default replace',
  settingDefaultReplaceVisibleTitle: 'Default replace',
  settingIncludeCodeBlockDesc: 'include code',
  settingIncludeCodeBlockTitle: 'Include code',
  settingLargeCodeBlockLineThresholdDesc: 'large code threshold',
  settingLargeCodeBlockLineThresholdTitle: 'Large code threshold',
  settingMinimapDesc: 'show minimap on panel',
  settingMinimapTitle: 'Document minimap',
  settingOptimizeLargeCodeBlocksDesc: 'optimize large code blocks',
  settingOptimizeLargeCodeBlocksTitle: 'Optimize large code blocks',
  settingPanelHotkeyDesc: 'panel hotkey',
  settingPanelHotkeyTitle: 'Panel hotkey',
  settingPreloadSelectionDesc: 'preload selection',
  settingPreloadSelectionTitle: 'Preload selection',
  settingRememberPositionDesc: 'remember position',
  settingRememberPositionTitle: 'Remember position',
  settingReplaceHotkeyDesc: 'replace hotkey',
  settingReplaceHotkeyTitle: 'Replace hotkey',
  settingSearchAttributeViewDesc: 'search database blocks',
  settingSearchAttributeViewTitle: 'Search database blocks',
  settingSaved: 'saved',
}

describe('plugin settings panel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    window.siyuan = {
      config: {
        keymap: {},
      },
    } as any
  })

  it('registers all hotkey and checkbox settings in the plugin settings panel', async () => {
    const { Setting } = await import('siyuan')
    const addItemSpy = vi.spyOn(Setting.prototype, 'addItem')
    const { default: FriendlySearchReplacePlugin } = await import('@/index')

    const plugin = new FriendlySearchReplacePlugin()
    plugin.i18n = settingsI18n
    ;(plugin as any).settingsData = await loadSettings()

    plugin.openSetting()

    expect(addItemSpy).toHaveBeenCalledTimes(11)
    expect(addItemSpy.mock.calls.map(([item]) => ({
      description: item.description,
      title: item.title,
    }))).toEqual([
      {
        description: 'panel hotkey',
        title: 'Panel hotkey',
      },
      {
        description: 'replace hotkey',
        title: 'Replace hotkey',
      },
      {
        description: 'default replace',
        title: 'Default replace',
      },
      {
        description: 'remember position',
        title: 'Remember position',
      },
      {
        description: 'show minimap on panel',
        title: 'Document minimap',
      },
      {
        description: 'preload selection',
        title: 'Preload selection',
      },
      {
        description: 'include code',
        title: 'Include code',
      },
      {
        description: '\u00a0\u00a0\u00a0\u00a0optimize large code blocks',
        title: '\u00a0\u00a0\u00a0\u00a0Optimize large code blocks',
      },
      {
        description: '\u00a0\u00a0\u00a0\u00a0large code threshold',
        title: '\u00a0\u00a0\u00a0\u00a0Large code threshold',
      },
      {
        description: 'search database blocks',
        title: 'Search database blocks',
      },
      {
        description: 'debug',
        title: 'Debug',
      },
    ])
  })

  it('disables nested code block settings until code block search is enabled', async () => {
    const { Setting } = await import('siyuan')
    const addItemSpy = vi.spyOn(Setting.prototype, 'addItem')
    const { default: FriendlySearchReplacePlugin } = await import('@/index')

    const plugin = new FriendlySearchReplacePlugin()
    plugin.i18n = settingsI18n
    ;(plugin as any).settingsData = await loadSettings()

    plugin.openSetting()

    const items = addItemSpy.mock.calls.map(([item]) => item)
    const includeCodeBlockInput = items[6].createActionElement() as HTMLInputElement
    const optimizeInput = items[7].createActionElement() as HTMLInputElement
    const thresholdInput = items[8].createActionElement() as HTMLInputElement

    expect(includeCodeBlockInput.disabled).toBe(false)
    expect(optimizeInput.disabled).toBe(true)
    expect(thresholdInput.disabled).toBe(true)
  })

  it('enables nested code block settings immediately after enabling code block search', async () => {
    const { Setting } = await import('siyuan')
    const addItemSpy = vi.spyOn(Setting.prototype, 'addItem')
    const { default: FriendlySearchReplacePlugin } = await import('@/index')

    const plugin = new FriendlySearchReplacePlugin()
    plugin.i18n = settingsI18n
    ;(plugin as any).settingsData = await loadSettings()

    plugin.openSetting()

    const items = addItemSpy.mock.calls.map(([item]) => item)
    const includeCodeBlockInput = items[6].createActionElement() as HTMLInputElement
    const optimizeInput = items[7].createActionElement() as HTMLInputElement
    const thresholdInput = items[8].createActionElement() as HTMLInputElement

    includeCodeBlockInput.checked = true
    includeCodeBlockInput.dispatchEvent(new Event('change'))

    await vi.waitFor(() => {
      expect(optimizeInput.disabled).toBe(false)
      expect(thresholdInput.disabled).toBe(false)
    })
  })

  it('shows live hotkeys from the Siyuan keymap in the plugin settings inputs', async () => {
    const { Setting } = await import('siyuan')
    const addItemSpy = vi.spyOn(Setting.prototype, 'addItem')
    const { default: FriendlySearchReplacePlugin } = await import('@/index')

    window.siyuan = {
      config: {
        keymap: {
          plugin: {
            'siyuan-sou-easy': {
              togglePanel: {
                custom: 'Ctrl+Alt+F',
                default: 'Ctrl+F11',
              },
              toggleReplacePanel: {
                custom: 'Ctrl+H',
                default: 'Ctrl+F12',
              },
            },
          },
        },
      },
    } as any

    const plugin = new FriendlySearchReplacePlugin()
    plugin.i18n = settingsI18n
    ;(plugin as any).settingsData = await loadSettings()

    plugin.openSetting()

    const items = addItemSpy.mock.calls.map(([item]) => item)
    const panelInput = items[0].createActionElement() as HTMLInputElement
    const replaceInput = items[1].createActionElement() as HTMLInputElement

    expect(panelInput.value).toBe('Ctrl+Alt+F')
    expect(replaceInput.value).toBe('Ctrl+H')
  })

  it('shows the updated plugin setting hotkey instead of a stale keymap value', async () => {
    const { Setting } = await import('siyuan')
    const addItemSpy = vi.spyOn(Setting.prototype, 'addItem')
    const { default: FriendlySearchReplacePlugin } = await import('@/index')

    window.siyuan = {
      config: {
        keymap: {
          plugin: {
            'siyuan-sou-easy': {
              togglePanel: {
                custom: 'Ctrl+F11',
                default: 'Ctrl+F11',
              },
              toggleReplacePanel: {
                custom: 'Ctrl+F12',
                default: 'Ctrl+F12',
              },
            },
          },
        },
      },
    } as any

    const plugin = new FriendlySearchReplacePlugin()
    plugin.i18n = settingsI18n
    plugin.commands = [
      {
        customHotkey: 'Ctrl+Alt+P',
        hotkey: 'Ctrl+F11',
        langKey: 'togglePanel',
      },
      {
        customHotkey: 'Ctrl+Alt+R',
        hotkey: 'Ctrl+F12',
        langKey: 'toggleReplacePanel',
      },
    ] as any
    ;(plugin as any).settingsData = await loadSettings()

    plugin.openSetting()

    const items = addItemSpy.mock.calls.map(([item]) => item)
    const panelInput = items[0].createActionElement() as HTMLInputElement
    const replaceInput = items[1].createActionElement() as HTMLInputElement

    expect(panelInput.value).toBe('Ctrl+Alt+P')
    expect(replaceInput.value).toBe('Ctrl+Alt+R')
  })
})
