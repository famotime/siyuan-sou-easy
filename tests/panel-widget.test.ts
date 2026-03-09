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

  it('toggles selection-only search from the toolbar button', async () => {
    mountPanel()
    applyPluginSettings({ ...DEFAULT_SETTINGS })
    openPanel(true)
    await nextTick()

    const selectionButton = host?.querySelector<HTMLButtonElement>('button[title="仅在选中范围内查找和替换"]')

    expect(selectionButton).not.toBeNull()
    expect((searchReplaceState.options as any).selectionOnly).toBe(false)

    selectionButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect((searchReplaceState.options as any).selectionOnly).toBe(true)
    expect(selectionButton?.classList.contains('sfsr-button--active')).toBe(true)
  })

  it('toggles minimap visibility from the separate options panel switch', async () => {
    mountPanel()
    applyPluginSettings({ ...DEFAULT_SETTINGS })
    openPanel(true)
    await nextTick()

    const inlineMinimapButton = host?.querySelector<HTMLButtonElement>('button[title="显示文档缩略图"]')
    const optionsButton = host?.querySelector<HTMLButtonElement>('button[title="显示控制选项"]')

    expect(inlineMinimapButton).toBeNull()
    expect(optionsButton).not.toBeNull()
    expect((searchReplaceState as any).minimapVisible).toBe(false)
    expect(host?.querySelector('.sfsr-options-panel')).toBeNull()

    optionsButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    const minimapSwitch = host?.querySelector<HTMLButtonElement>('button[role="switch"][title="显示或隐藏文档缩略图"]')

    expect(host?.querySelector('.sfsr-options-panel')).not.toBeNull()
    expect(minimapSwitch).not.toBeNull()
    expect(minimapSwitch?.getAttribute('aria-checked')).toBe('false')

    minimapSwitch?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect((searchReplaceState as any).minimapVisible).toBe(true)
    expect(minimapSwitch?.getAttribute('aria-checked')).toBe('true')
  })

  it('opens with a narrower default width to keep the toolbar compact', async () => {
    mountPanel()
    applyPluginSettings({ ...DEFAULT_SETTINGS })
    openPanel(true)
    await nextTick()

    const panel = getPanelElement()

    expect(panel.style.width).toBe('648px')
  })

  it('expands the panel width by dragging the left resize handle', async () => {
    mountPanel()
    applyPluginSettings({ ...DEFAULT_SETTINGS })
    openPanel(true)
    await nextTick()

    const panel = getPanelElement()
    const resizeHandle = host?.querySelector<HTMLElement>('.sfsr-resize-handle')

    expect(resizeHandle).not.toBeNull()

    stubPanelRect(panel, { width: 648 })

    resizeHandle?.dispatchEvent(createPointerEvent('pointerdown', {
      button: 0,
      clientX: 100,
      clientY: 30,
      pointerId: 2,
    }))
    window.dispatchEvent(createPointerEvent('pointermove', {
      clientX: 40,
      clientY: 30,
      pointerId: 2,
    }))
    await nextTick()
    window.dispatchEvent(createPointerEvent('pointerup', { pointerId: 2 }))

    expect(panel.style.width).toBe('708px')
    expect(searchReplaceState.panelPosition).toEqual({
      left: 40,
      top: 20,
    })
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

  function stubPanelRect(panel: HTMLElement, rect: Partial<DOMRect> = {}) {
    const width = rect.width ?? 320
    const height = rect.height ?? 64
    const left = rect.left ?? 100
    const top = rect.top ?? 20

    Object.defineProperty(panel, 'offsetWidth', {
      configurable: true,
      value: width,
    })
    Object.defineProperty(panel, 'offsetHeight', {
      configurable: true,
      value: height,
    })
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
      bottom: top + height,
      height,
      left,
      right: left + width,
      toJSON: () => ({}),
      top,
      width,
      x: left,
      y: top,
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
    ;(searchReplaceState as any).minimapVisible = false
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
