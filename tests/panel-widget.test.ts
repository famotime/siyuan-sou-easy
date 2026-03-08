// @vitest-environment jsdom

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  createApp,
  nextTick,
} from 'vue'

import App from '@/App.vue'
import {
  applyPluginSettings,
  closePanel,
  openPanel,
  searchReplaceState,
} from '@/features/search-replace/store'
import {
  DEFAULT_SETTINGS,
  createSearchOptionsFromSettings,
} from '@/settings'

describe('search panel replace toggle', () => {
  let host: HTMLDivElement | null = null
  let app: ReturnType<typeof createApp> | null = null

  beforeEach(() => {
    vi.useFakeTimers()
    resetState()
  })

  afterEach(() => {
    app?.unmount()
    host?.remove()
    closePanel()
    vi.clearAllTimers()
    vi.restoreAllMocks()
    vi.useRealTimers()
    host = null
    app = null
  })

  it('opens collapsed by default with only the search row visible', async () => {
    mountPanel()
    applyPluginSettings({ ...DEFAULT_SETTINGS })
    openPanel(true)
    await nextTick()

    const replaceToggle = host?.querySelector<HTMLButtonElement>('.sfsr-replace-toggle')

    expect(replaceToggle).not.toBeNull()
    expect(replaceToggle?.getAttribute('aria-expanded')).toBe('false')
    expect(host?.querySelector('.sfsr-drag-handle')).toBeNull()
    expect(host?.querySelector('.sfsr-row--secondary')).toBeNull()
  })

  it('expands the replace row after clicking the left toggle', async () => {
    mountPanel()
    applyPluginSettings({ ...DEFAULT_SETTINGS })
    openPanel(true)
    await nextTick()

    const replaceToggle = host?.querySelector<HTMLButtonElement>('.sfsr-replace-toggle')
    replaceToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(searchReplaceState.replaceVisible).toBe(true)
    expect(host?.querySelector('.sfsr-row--secondary')).not.toBeNull()
    expect(host?.querySelector('.sfsr-replace-toggle')?.getAttribute('aria-expanded')).toBe('true')
  })

  it('stacks both rows beside a two-line replace toggle when expanded', async () => {
    mountPanel()
    applyPluginSettings({ ...DEFAULT_SETTINGS })
    openPanel(true)
    await nextTick()

    const replaceToggle = host?.querySelector<HTMLButtonElement>('.sfsr-replace-toggle')
    replaceToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    const layout = host?.querySelector<HTMLElement>('.sfsr-layout')
    const main = host?.querySelector<HTMLElement>('.sfsr-main')
    const rows = main?.querySelectorAll<HTMLElement>('.sfsr-row')

    expect(layout?.classList.contains('sfsr-layout--replace-visible')).toBe(true)
    expect(replaceToggle?.classList.contains('sfsr-replace-toggle--expanded')).toBe(true)
    expect(main).not.toBeNull()
    expect(rows).toHaveLength(2)
    expect(rows?.[0]?.querySelector('input[placeholder="查找"]')).not.toBeNull()
    expect(rows?.[1]?.querySelector('input[placeholder="替换"]')).not.toBeNull()
  })

  it('shows regex usage help and examples when regex mode is enabled', async () => {
    mountPanel()
    applyPluginSettings({ ...DEFAULT_SETTINGS })
    openPanel(true)
    await nextTick()

    searchReplaceState.options.useRegex = true
    await nextTick()

    const help = host?.querySelector<HTMLElement>('.sfsr-regex-help')

    expect(help).not.toBeNull()
    expect(help?.textContent).toContain('正则搜索帮助')
    expect(help?.textContent).toContain('安装|部署')
    expect(help?.textContent).toContain('$1')
  })

  it('starts dragging from non-interactive panel content', async () => {
    mountPanel()
    applyPluginSettings({ ...DEFAULT_SETTINGS })
    openPanel(true)
    await nextTick()

    const panel = getPanelElement()
    const count = host?.querySelector<HTMLElement>('.sfsr-count')

    expect(count).not.toBeNull()

    stubPanelRect(panel)

    count?.dispatchEvent(createPointerEvent('pointerdown', {
      button: 0,
      clientX: 120,
      clientY: 30,
      pointerId: 1,
    }))
    window.dispatchEvent(createPointerEvent('pointermove', {
      clientX: 170,
      clientY: 60,
      pointerId: 1,
    }))
    window.dispatchEvent(createPointerEvent('pointerup', { pointerId: 1 }))

    expect(searchReplaceState.panelPosition).toEqual({
      left: 150,
      top: 50,
    })
  })

  it('does not start dragging from the find input', async () => {
    mountPanel()
    applyPluginSettings({ ...DEFAULT_SETTINGS })
    openPanel(true)
    await nextTick()

    const panel = getPanelElement()
    const findInput = host?.querySelector<HTMLInputElement>('.sfsr-input')

    expect(findInput).not.toBeNull()

    stubPanelRect(panel)

    findInput?.dispatchEvent(createPointerEvent('pointerdown', {
      button: 0,
      clientX: 120,
      clientY: 30,
      pointerId: 1,
    }))
    window.dispatchEvent(createPointerEvent('pointermove', {
      clientX: 170,
      clientY: 60,
      pointerId: 1,
    }))
    window.dispatchEvent(createPointerEvent('pointerup', { pointerId: 1 }))

    expect(searchReplaceState.panelPosition).toBeNull()
  })

  it('resets the stored panel position on double click from non-interactive content', async () => {
    mountPanel()
    applyPluginSettings({ ...DEFAULT_SETTINGS })
    searchReplaceState.panelPosition = { left: 150, top: 50 }
    openPanel(true)
    await nextTick()

    const count = host?.querySelector<HTMLElement>('.sfsr-count')

    expect(count).not.toBeNull()

    count?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))

    expect(searchReplaceState.panelPosition).toBeNull()
  })

  function mountPanel() {
    host = document.createElement('div')
    document.body.appendChild(host)
    app = createApp(App)
    app.mount(host)
  }

  function getPanelElement() {
    const panel = host?.querySelector<HTMLElement>('.sfsr-panel')

    expect(panel).not.toBeNull()

    return panel as HTMLElement
  }

  function stubPanelRect(panel: HTMLElement) {
    Object.defineProperty(panel, 'offsetWidth', {
      configurable: true,
      value: 320,
    })
    Object.defineProperty(panel, 'offsetHeight', {
      configurable: true,
      value: 64,
    })
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
      bottom: 84,
      height: 64,
      left: 100,
      right: 420,
      toJSON: () => ({}),
      top: 20,
      width: 320,
      x: 100,
      y: 20,
    })
  }

  function createPointerEvent(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
    const PointerCtor = window.PointerEvent ?? window.MouseEvent
    const event = new PointerCtor(type, {
      bubbles: true,
      ...init,
    })

    if (!('pointerId' in event)) {
      Object.defineProperty(event, 'pointerId', {
        configurable: true,
        value: init.pointerId ?? 1,
      })
    }

    return event
  }

  function resetState() {
    searchReplaceState.visible = false
    searchReplaceState.replaceVisible = DEFAULT_SETTINGS.defaultReplaceVisible
    searchReplaceState.panelPosition = null
    searchReplaceState.query = ''
    searchReplaceState.replacement = ''
    searchReplaceState.options = createSearchOptionsFromSettings(DEFAULT_SETTINGS)
    searchReplaceState.currentRootId = ''
    searchReplaceState.currentTitle = ''
    searchReplaceState.matches = []
    searchReplaceState.currentIndex = 0
    searchReplaceState.error = ''
    searchReplaceState.busy = false
  }
})
