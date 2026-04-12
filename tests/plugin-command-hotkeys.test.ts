// @vitest-environment jsdom

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const storeState = vi.hoisted(() => ({
  searchReplaceState: {
    replaceVisible: false,
    visible: false,
  },
}))

const loadSettings = vi.fn().mockResolvedValue({
  debugLog: false,
  defaultReplaceVisible: false,
  includeCodeBlock: false,
  minimapVisible: false,
  panelHotkey: 'Ctrl+Alt+Shift+G',
  preserveCase: false,
  preloadSelection: true,
  rememberPanelPosition: true,
  replacePanelHotkey: 'Ctrl+Alt+Shift+H',
})

const onEditorContextChanged = vi.fn()
const closePanel = vi.fn()
const openPanel = vi.fn()
const createEditorContextFromProtyleLike = vi.fn((protyle) => ({
  protyle: protyle.element,
  rootId: protyle.block.rootID,
  title: 'Doc 1',
}))
const createEditorContextFromElement = vi.fn(() => null)

vi.mock('@/main', () => ({
  destroy: vi.fn(),
  init: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/features/search-replace/store', () => ({
  applyPluginSettings: vi.fn(),
  closePanel,
  onEditorContextChanged,
  openPanel,
  searchReplaceState: storeState.searchReplaceState,
}))

vi.mock('@/features/search-replace/editor', () => ({
  createEditorContextFromElement,
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
  SETTINGS_STORAGE: 'settings.json',
  loadSettings,
  normalizeSettings: vi.fn(value => value),
  saveSettings: vi.fn(),
}))

describe('plugin command hotkeys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    storeState.searchReplaceState.visible = false
    storeState.searchReplaceState.replaceVisible = false
  })

  it('registers panel commands with the adapted persisted hotkeys', async () => {
    const { default: FriendlySearchReplacePlugin } = await import('@/index')
    const siyuan = await import('siyuan')

    const plugin = new FriendlySearchReplacePlugin()
    plugin.i18n = {
      addTopBarIcon: 'Friendly Search Replace',
    }

    await plugin.onload()

    expect(plugin.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({
        langKey: 'togglePanel',
        hotkey: '⌘F11',
        customHotkey: '⌥⇧⌘G',
      }),
      expect.objectContaining({
        langKey: 'toggleReplacePanel',
        hotkey: '⌘F12',
        customHotkey: '⌥⇧⌘H',
      }),
    ]))
    expect(siyuan.adaptHotkey).toHaveBeenCalledWith('Ctrl+F11')
    expect(siyuan.adaptHotkey).toHaveBeenCalledWith('Ctrl+Alt+Shift+G')
    expect(siyuan.adaptHotkey).toHaveBeenCalledWith('Ctrl+F12')
    expect(siyuan.adaptHotkey).toHaveBeenCalledWith('Ctrl+Alt+Shift+H')
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
    expect(openPanel).toHaveBeenCalledWith(true, false)
  })

  it('opens the panel from a saved hotkey even when command routing does not provide a context callback', async () => {
    const { default: FriendlySearchReplacePlugin } = await import('@/index')

    const plugin = new FriendlySearchReplacePlugin()
    plugin.i18n = {
      addTopBarIcon: 'Friendly Search Replace',
    }

    await plugin.onload()
    openPanel.mockClear()
    createEditorContextFromElement.mockClear()

    const target = document.createElement('div')
    target.addEventListener('keydown', (event) => {
      event.stopPropagation()
    })
    document.body.appendChild(target)

    target.dispatchEvent(new KeyboardEvent('keydown', {
      altKey: true,
      bubbles: true,
      cancelable: true,
      code: 'KeyG',
      ctrlKey: true,
      key: 'g',
      shiftKey: true,
    }))

    expect(createEditorContextFromElement).toHaveBeenCalledWith(null)
    expect(openPanel).toHaveBeenCalledWith(true, false)
  })

  it('uses the updated command hotkey after plugin settings change even if keymap is stale', async () => {
    const { default: FriendlySearchReplacePlugin } = await import('@/index')

    window.siyuan = {
      config: {
        keymap: {
          plugin: {
            'siyuan-sou-easy': {
              togglePanel: {
                custom: 'Ctrl+Alt+Shift+G',
                default: 'Ctrl+F11',
              },
              toggleReplacePanel: {
                custom: 'Ctrl+Alt+Shift+H',
                default: 'Ctrl+F12',
              },
            },
          },
        },
      },
    } as any

    const plugin = new FriendlySearchReplacePlugin()
    plugin.i18n = {
      addTopBarIcon: 'Friendly Search Replace',
      settingSaved: 'Saved',
    }

    await plugin.onload()
    openPanel.mockClear()
    createEditorContextFromElement.mockClear()

    await (plugin as any).applySettings({
      debugLog: false,
      defaultReplaceVisible: false,
      includeCodeBlock: false,
      minimapVisible: false,
      panelHotkey: 'Ctrl+Alt+Shift+P',
      preserveCase: false,
      preloadSelection: true,
      rememberPanelPosition: true,
      replacePanelHotkey: 'Ctrl+Alt+Shift+R',
    }, false)

    document.body.dispatchEvent(new KeyboardEvent('keydown', {
      altKey: true,
      bubbles: true,
      cancelable: true,
      code: 'KeyR',
      ctrlKey: true,
      key: 'r',
      shiftKey: true,
    }))

    expect(openPanel).toHaveBeenCalledWith(true, true)
  })

  it('keeps the panel open when the active mode hotkey is pressed again', async () => {
    const { default: FriendlySearchReplacePlugin } = await import('@/index')

    const plugin = new FriendlySearchReplacePlugin()
    plugin.i18n = {
      addTopBarIcon: 'Friendly Search Replace',
    }

    await plugin.onload()
    openPanel.mockClear()
    storeState.searchReplaceState.visible = true
    storeState.searchReplaceState.replaceVisible = false

    document.body.dispatchEvent(new KeyboardEvent('keydown', {
      altKey: true,
      bubbles: true,
      cancelable: true,
      code: 'KeyG',
      ctrlKey: true,
      key: 'g',
      shiftKey: true,
    }))

    expect(openPanel).toHaveBeenCalledWith(true, false)
  })

  it('closes the panel from Escape even when focus stays outside the panel', async () => {
    const { default: FriendlySearchReplacePlugin } = await import('@/index')

    const plugin = new FriendlySearchReplacePlugin()
    plugin.i18n = {
      addTopBarIcon: 'Friendly Search Replace',
    }

    await plugin.onload()
    closePanel.mockClear()
    storeState.searchReplaceState.visible = true

    document.body.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Escape',
    }))

    expect(closePanel).toHaveBeenCalledTimes(1)
  })
})
