import type { App } from 'siyuan'
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

const onEditorContextChanged = vi.fn()
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
  openPanel: vi.fn(),
}))

vi.mock('@/features/search-replace/editor', () => ({
  createEditorContextFromProtyleLike,
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
  normalizeSettings: vi.fn((value) => value),
  saveSettings: vi.fn(),
}))

describe('plugin editor context events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('passes protyle event detail into the search context cache', async () => {
    const { default: FriendlySearchReplacePlugin } = await import('@/index')

    const plugin = new FriendlySearchReplacePlugin(pluginOptions)
    plugin.i18n = {
      addTopBarIcon: 'Friendly Search Replace',
    }
    plugin.eventBus.on = vi.fn()

    await plugin.onload()

    const registration = (plugin.eventBus.on as ReturnType<typeof vi.fn>).mock.calls.find(([eventName]) => eventName === 'click-editorcontent')

    expect(registration).toBeTruthy()

    const handler = registration?.[1] as (event: CustomEvent<any>) => void
    const protyle = {
      block: {
        rootID: 'root-1',
      },
      element: document.createElement('div'),
    }

    handler(new CustomEvent('click-editorcontent', {
      detail: {
        protyle,
      },
    }))

    expect(createEditorContextFromProtyleLike).toHaveBeenCalledWith(protyle)
    expect(onEditorContextChanged).toHaveBeenCalledWith(expect.objectContaining({
      rootId: 'root-1',
      title: 'Doc 1',
    }))
  })

  it('registers and unregisters the full editor event list', async () => {
    const { default: FriendlySearchReplacePlugin } = await import('@/index')

    const plugin = new FriendlySearchReplacePlugin(pluginOptions)
    plugin.i18n = {
      addTopBarIcon: 'Friendly Search Replace',
    }
    plugin.eventBus.on = vi.fn()
    plugin.eventBus.off = vi.fn()

    await plugin.onload()
    plugin.onunload()

    expect((plugin.eventBus.on as ReturnType<typeof vi.fn>).mock.calls.map(([eventName]) => eventName)).toEqual([
      'switch-protyle',
      'click-editorcontent',
      'loaded-protyle-dynamic',
      'loaded-protyle-static',
      'destroy-protyle',
    ])
    expect((plugin.eventBus.off as ReturnType<typeof vi.fn>).mock.calls.map(([eventName]) => eventName)).toEqual([
      'switch-protyle',
      'click-editorcontent',
      'loaded-protyle-dynamic',
      'loaded-protyle-static',
      'destroy-protyle',
    ])
  })

  it('removes persisted plugin data during uninstall', async () => {
    const { default: FriendlySearchReplacePlugin } = await import('@/index')

    const plugin = new FriendlySearchReplacePlugin(pluginOptions)
    plugin.i18n = {
      addTopBarIcon: 'Friendly Search Replace',
    }
    plugin.removeData = vi.fn().mockResolvedValue(null)

    await plugin.uninstall?.()

    expect(plugin.removeData).toHaveBeenCalledTimes(4)
    expect(plugin.removeData).toHaveBeenNthCalledWith(1, 'settings.json')
    expect(plugin.removeData).toHaveBeenNthCalledWith(2, 'ui-state.json')
    expect(plugin.removeData).toHaveBeenNthCalledWith(3, 'saved_searches.json')
    expect(plugin.removeData).toHaveBeenNthCalledWith(4, 'replace_transactions.json')
  })
})
