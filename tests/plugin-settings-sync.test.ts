// @vitest-environment jsdom

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { adaptHotkey } from 'siyuan'

const applyPluginSettings = vi.fn()
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
const normalizeSettings = vi.fn(value => ({
  ...value,
  normalized: true,
}))
const saveSettings = vi.fn(async () => undefined)

vi.mock('@/main', () => ({
  destroy: vi.fn(),
  init: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/features/search-replace/store', () => ({
  applyPluginSettings,
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
  loadSettings,
  normalizeSettings,
  saveSettings,
}))

describe('plugin settings sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('syncs command hotkeys after saving settings', async () => {
    const { default: FriendlySearchReplacePlugin } = await import('@/index')

    const plugin = new FriendlySearchReplacePlugin()
    plugin.i18n = {
      settingSaved: 'Saved',
    }
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
      {
        customHotkey: 'Ctrl+P',
        hotkey: 'Ctrl+P',
        langKey: 'otherCommand',
      },
    ] as any

    await (plugin as any).applySettings({
      debugLog: true,
      defaultReplaceVisible: true,
      includeCodeBlock: true,
      panelHotkey: 'Ctrl+Alt+F',
      preserveCase: true,
      preloadSelection: false,
      rememberPanelPosition: false,
      replacePanelHotkey: 'Ctrl+Alt+H',
    }, false)

    expect(normalizeSettings).toHaveBeenCalledWith(expect.objectContaining({
      panelHotkey: 'Ctrl+Alt+F',
      replacePanelHotkey: 'Ctrl+Alt+H',
    }))
    expect(applyPluginSettings).toHaveBeenCalledWith(expect.objectContaining({
      normalized: true,
      panelHotkey: 'Ctrl+Alt+F',
      replacePanelHotkey: 'Ctrl+Alt+H',
    }))
    expect(plugin.commands[0]).toMatchObject({
      customHotkey: adaptHotkey('Ctrl+Alt+F'),
      hotkey: adaptHotkey('Ctrl+Shift+F'),
    })
    expect(plugin.commands[1]).toMatchObject({
      customHotkey: adaptHotkey('Ctrl+Alt+H'),
      hotkey: adaptHotkey('Ctrl+Shift+H'),
    })
    expect(plugin.commands[2]).toMatchObject({
      customHotkey: 'Ctrl+P',
      hotkey: 'Ctrl+P',
    })
    expect(saveSettings).toHaveBeenCalledWith(plugin, expect.objectContaining({
      normalized: true,
      panelHotkey: 'Ctrl+Alt+F',
      replacePanelHotkey: 'Ctrl+Alt+H',
    }))
  })

  it('shows a saved message by default after applying settings', async () => {
    const { default: FriendlySearchReplacePlugin } = await import('@/index')
    const siyuan = await import('siyuan')

    const plugin = new FriendlySearchReplacePlugin()
    plugin.i18n = {
      settingSaved: 'Saved',
    }
    plugin.commands = [] as any

    await (plugin as any).applySettings({
      debugLog: false,
      defaultReplaceVisible: false,
      includeCodeBlock: false,
      panelHotkey: 'Ctrl+Shift+F',
      preserveCase: false,
      preloadSelection: true,
      rememberPanelPosition: true,
      replacePanelHotkey: 'Ctrl+Shift+H',
    })

    expect(siyuan.showMessage).toHaveBeenCalledWith('Saved', 2500, 'info')
  })
})
