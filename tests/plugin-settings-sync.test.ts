import type { App } from 'siyuan'
import { adaptHotkey } from 'siyuan'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

// siyuan 类型声明的 Plugin 构造需要 { app, name, i18n }；运行时 mock 无参构造会忽略该参数
const pluginOptions = {
  app: {} as App,
  name: 'siyuan-sou-easy',
  i18n: {},
}

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
const normalizeSettings = vi.fn((value) => ({
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

    const plugin = new FriendlySearchReplacePlugin(pluginOptions)
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

    const plugin = new FriendlySearchReplacePlugin(pluginOptions)
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

  it('syncs updated hotkeys back to the Siyuan keymap when changed from plugin settings', async () => {
    const { default: FriendlySearchReplacePlugin } = await import('@/index')
    const siyuan = await import('siyuan')

    window.siyuan = {
      config: {
        keymap: {
          plugin: {
            'siyuan-sou-easy': {
              togglePanel: {
                custom: 'Ctrl+Shift+F',
                default: 'Ctrl+Shift+F',
              },
              toggleReplacePanel: {
                custom: 'Ctrl+Shift+H',
                default: 'Ctrl+Shift+H',
              },
            },
          },
        },
      },
    } as any

    const plugin = new FriendlySearchReplacePlugin(pluginOptions)
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
    ] as any

    const accepted = await (plugin as any).updateHotkeySetting('panelHotkey', 'Ctrl+Alt+F')

    expect(accepted).toBe(true)
    // 全局 Window.siyuan 声明缺 config 字段，按上方写入的结构做局部窄化
    const siyuanWindow = window.siyuan as typeof window.siyuan & {
      config: {
        keymap: {
          plugin: Record<string, Record<string, { custom: string, default: string }>>
        }
      }
    }
    expect(siyuanWindow.config.keymap.plugin['siyuan-sou-easy'].togglePanel.custom).toBe('Ctrl+Alt+F')
    expect(siyuan.fetchSyncPost).toHaveBeenCalledWith('/api/setting/setKeymap', {
      data: siyuanWindow.config.keymap,
    })
  })
})
