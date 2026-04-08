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

describe('plugin settings panel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('registers all hotkey and checkbox settings in the plugin settings panel', async () => {
    const { Setting } = await import('siyuan')
    const addItemSpy = vi.spyOn(Setting.prototype, 'addItem')
    const { default: FriendlySearchReplacePlugin } = await import('@/index')

    const plugin = new FriendlySearchReplacePlugin()
    plugin.i18n = {
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
    }
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
        description: 'optimize large code blocks',
        title: 'Optimize large code blocks',
      },
      {
        description: 'large code threshold',
        title: 'Large code threshold',
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
})
