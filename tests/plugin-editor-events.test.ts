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
  loadSettings,
  normalizeSettings: vi.fn(value => value),
  saveSettings: vi.fn(),
}))

describe('plugin editor context events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('passes protyle event detail into the search context cache', async () => {
    const { default: FriendlySearchReplacePlugin } = await import('@/index')

    const plugin = new FriendlySearchReplacePlugin()
    plugin.i18n = {
      addTopBarIcon: 'Friendly Search Replace',
    }
    plugin.eventBus.on = vi.fn()

    await plugin.onload()

    const registration = (plugin.eventBus.on as ReturnType<typeof vi.fn>).mock.calls
      .find(([eventName]) => eventName === 'click-editorcontent')

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

    const plugin = new FriendlySearchReplacePlugin()
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
})
