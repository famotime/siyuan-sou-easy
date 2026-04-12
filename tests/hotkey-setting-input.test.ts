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
  panelHotkey: 'Ctrl+Shift+F',
  preserveCase: false,
  preloadSelection: true,
  rememberPanelPosition: true,
  replacePanelHotkey: 'Ctrl+Shift+H',
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
    panelHotkey: 'Ctrl+Shift+F',
    preserveCase: false,
    preloadSelection: true,
    rememberPanelPosition: true,
    replacePanelHotkey: 'Ctrl+Shift+H',
  },
  SETTINGS_STORAGE: 'settings.json',
  loadSettings,
  normalizeSettings: vi.fn(value => value),
  saveSettings: vi.fn(),
}))

describe('hotkey setting input', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    window.siyuan = {
      config: {
        keymap: {
          editor: { general: {} },
          general: {
            globalSearch: {
              custom: 'Ctrl+P',
              default: 'Ctrl+P',
            },
          },
          plugin: {},
        },
      },
    } as any
  })

  it('captures shortcut input from keydown and saves non-conflicting values', async () => {
    const { default: FriendlySearchReplacePlugin } = await import('@/index')

    const plugin = new FriendlySearchReplacePlugin()
    const applySettingsSpy = vi.spyOn(plugin as any, 'applySettings').mockResolvedValue(undefined)
    ;(plugin as any).settingsData = await loadSettings()

    const input = (plugin as any).createHotkeyInput('Ctrl+Shift+F', async (value: string) => {
      return await (plugin as any).updateHotkeySetting('panelHotkey', value)
    }) as HTMLInputElement

    input.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      ctrlKey: true,
      key: 'k',
      shiftKey: true,
    }))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(applySettingsSpy).toHaveBeenCalledWith(expect.objectContaining({
      panelHotkey: 'Ctrl+Shift+K',
    }))
    expect(input.value).toBe('Ctrl+Shift+K')
  })

  it('shows a warning and keeps the old value when the shortcut conflicts', async () => {
    const { default: FriendlySearchReplacePlugin } = await import('@/index')
    const siyuan = await import('siyuan')

    const plugin = new FriendlySearchReplacePlugin()
    const applySettingsSpy = vi.spyOn(plugin as any, 'applySettings').mockResolvedValue(undefined)
    ;(plugin as any).settingsData = await loadSettings()
    plugin.commands = [
      {
        customHotkey: 'Ctrl+Shift+F',
        hotkey: 'Ctrl+Shift+F',
        langKey: 'togglePanel',
      },
      {
        customHotkey: 'Ctrl+Shift+H',
        hotkey: 'Ctrl+Shift+H',
        langKey: 'toggleReplacePanel',
      },
    ] as any

    const input = (plugin as any).createHotkeyInput('Ctrl+Shift+F', async (value: string) => {
      return await (plugin as any).updateHotkeySetting('panelHotkey', value)
    }) as HTMLInputElement

    input.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      ctrlKey: true,
      key: 'h',
      shiftKey: true,
    }))
    await Promise.resolve()
    await Promise.resolve()

    expect(applySettingsSpy).not.toHaveBeenCalled()
    expect(siyuan.showMessage).toHaveBeenCalled()
    expect(input.value).toBe('Ctrl+Shift+F')
  })

  it('accepts a hotkey that is already assigned to the same plugin command in Siyuan keymap', async () => {
    const { default: FriendlySearchReplacePlugin } = await import('@/index')

    window.siyuan = {
      config: {
        keymap: {
          plugin: {
            'siyuan-sou-easy': {
              toggleReplacePanel: {
                custom: 'Ctrl+H',
                default: 'Ctrl+Shift+H',
              },
            },
          },
        },
      },
    } as any

    const plugin = new FriendlySearchReplacePlugin()
    const applySettingsSpy = vi.spyOn(plugin as any, 'applySettings').mockResolvedValue(undefined)
    ;(plugin as any).settingsData = await loadSettings()

    const accepted = await (plugin as any).updateHotkeySetting('replacePanelHotkey', 'Ctrl+H')

    expect(accepted).toBe(true)
    expect(applySettingsSpy).toHaveBeenCalledWith(expect.objectContaining({
      replacePanelHotkey: 'Ctrl+H',
    }))
  })
})
