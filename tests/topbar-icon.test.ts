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
  panelHotkey: 'Ctrl+F',
  preserveCase: false,
  preloadSelection: true,
  rememberPanelPosition: true,
  replacePanelHotkey: 'Ctrl+H',
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
    panelHotkey: 'Ctrl+F',
    preserveCase: false,
    preloadSelection: true,
    rememberPanelPosition: true,
    replacePanelHotkey: 'Ctrl+H',
  },
  SETTINGS_STORAGE: 'settings.json',
  loadSettings,
  normalizeSettings: vi.fn(value => value),
  saveSettings: vi.fn(),
}))

describe('plugin top bar icon', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('uses a dedicated icon instead of SiYuan iconSearch', async () => {
    const { default: FriendlySearchReplacePlugin } = await import('@/index')

    const plugin = new FriendlySearchReplacePlugin()
    plugin.i18n = {
      addTopBarIcon: 'Friendly Search Replace',
    }
    const addIconsSpy = vi.spyOn(plugin, 'addIcons')
    const addTopBarSpy = vi.spyOn(plugin, 'addTopBar')

    await plugin.onload()

    expect(addIconsSpy).toHaveBeenCalledTimes(1)
    expect(addTopBarSpy).toHaveBeenCalledTimes(1)
    expect(addTopBarSpy.mock.calls[0][0]).toEqual(expect.objectContaining({
      icon: expect.not.stringMatching(/^iconSearch$/),
    }))
  })

  it('uses the provided magnifier plus T glyph design', async () => {
    const { SEARCH_REPLACE_TOP_BAR_ICON } = await import('@/icons')

    expect(SEARCH_REPLACE_TOP_BAR_ICON).toContain('viewBox="0 0 48 48"')
    expect(SEARCH_REPLACE_TOP_BAR_ICON).toContain('<circle cx="22.8345" cy="22.8345" r="17"')
    expect(SEARCH_REPLACE_TOP_BAR_ICON).toContain('d="M35 35L41 41"')
    expect(SEARCH_REPLACE_TOP_BAR_ICON).toContain('d="M23 17V31"')
    expect(SEARCH_REPLACE_TOP_BAR_ICON).toContain('d="M18 17H23H28"')
  })
})
