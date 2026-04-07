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
    const count = host?.querySelector<HTMLElement>('.sfsr-count')

    expect(replaceToggle).not.toBeNull()
    expect(count?.textContent?.trim()).toBe('0 / 0')
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
    const selectionIcon = selectionButton?.querySelector<SVGElement>('.sfsr-toolbar-icon')

    expect(selectionButton).not.toBeNull()
    expect(selectionIcon).not.toBeNull()
    expect(selectionButton?.textContent?.trim()).toBe('')
    expect((searchReplaceState.options as any).selectionOnly).toBe(false)

    selectionButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect((searchReplaceState.options as any).selectionOnly).toBe(true)
    expect(selectionButton?.classList.contains('sfsr-button--active')).toBe(true)
  })

  it('renders whole-word matching as a dedicated boundary icon instead of plain text', async () => {
    mountPanel()
    applyPluginSettings({ ...DEFAULT_SETTINGS })
    openPanel(true)
    await nextTick()

    const wholeWordButton = host?.querySelector<HTMLButtonElement>('button[title="全词匹配"]')
    const wholeWordIcon = wholeWordButton?.querySelector<SVGElement>('.sfsr-toolbar-icon--whole-word')
    const plainTextNodes = Array.from(wholeWordButton?.childNodes ?? []).filter(node => (
      node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
    ))

    expect(wholeWordButton).not.toBeNull()
    expect(wholeWordIcon).not.toBeNull()
    expect(wholeWordButton?.classList.contains('sfsr-icon-button--wide')).toBe(true)
    expect(wholeWordButton?.classList.contains('sfsr-icon-button--compact')).toBe(true)
    expect(wholeWordIcon?.classList.contains('sfsr-toolbar-icon--whole-word-wide')).toBe(true)
    expect(plainTextNodes).toHaveLength(0)
    expect(wholeWordIcon?.querySelectorAll('.sfsr-toolbar-icon-boundary')).toHaveLength(2)
    expect(wholeWordIcon?.querySelector('.sfsr-toolbar-icon-word')?.textContent).toBe('ab')
  })

  it('shows a preserve-case toggle in the replace toolbar and updates the runtime state', async () => {
    mountPanel()
    applyPluginSettings({ ...DEFAULT_SETTINGS })
    openPanel(true, true)
    await nextTick()

    const preserveCaseButton = host?.querySelector<HTMLButtonElement>('button[title="保留大小写"]')

    expect(preserveCaseButton).not.toBeNull()
    expect(searchReplaceState.preserveCase).toBe(false)

    preserveCaseButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(searchReplaceState.preserveCase).toBe(true)
    expect(preserveCaseButton?.classList.contains('sfsr-button--active')).toBe(true)
  })

  it('disables replacement actions and shows a read-only notice for attribute view matches', async () => {
    mountPanel()
    applyPluginSettings({ ...DEFAULT_SETTINGS })
    searchReplaceState.matches = [{
      attributeView: {
        avBlockId: 'av-block-1',
        avID: 'av-1',
        columnName: '电影',
        itemID: 'item-1',
        keyID: 'col-1',
      },
      blockId: 'av-block-1',
      blockIndex: 0,
      blockType: 'NodeAttributeView',
      end: 4,
      id: 'av:av-block-1:item-1:col-1:0:4',
      matchedText: '热辣滚烫',
      previewText: '电影: [热辣滚烫]',
      replaceable: false,
      rootId: 'root-1',
      sourceKind: 'attribute-view',
      start: 0,
    }] as any
    openPanel(true, true)
    await nextTick()

    const buttons = host?.querySelectorAll<HTMLButtonElement>('.sfsr-row--secondary .sfsr-action')
    const status = host?.querySelector<HTMLElement>('.sfsr-status')

    expect(buttons).toHaveLength(3)
    expect(buttons?.[0]?.disabled).toBe(true)
    expect(buttons?.[2]?.disabled).toBe(true)
    expect(status?.textContent).toContain('数据库结果仅支持搜索与高亮，不支持替换')
  })

  it('disables the replace input and replace actions when the current document is readonly', async () => {
    mountPanel()
    applyPluginSettings({ ...DEFAULT_SETTINGS })
    searchReplaceState.documentReadonly = true
    searchReplaceState.matches = [{
      blockId: 'block-1',
      blockIndex: 0,
      blockType: 'NodeParagraph',
      end: 3,
      id: 'block-1:0:3',
      matchedText: 'foo',
      previewText: '[foo] bar',
      replaceable: true,
      rootId: 'root-1',
      start: 0,
    }] as any
    openPanel(true, true)
    await nextTick()

    const replaceInput = host?.querySelector<HTMLInputElement>('.sfsr-row--secondary .sfsr-input')
    const buttons = host?.querySelectorAll<HTMLButtonElement>('.sfsr-row--secondary .sfsr-action')

    expect(replaceInput?.disabled).toBe(true)
    expect(buttons).toHaveLength(3)
    expect(buttons?.[0]?.disabled).toBe(true)
    expect(buttons?.[1]?.disabled).toBe(false)
    expect(buttons?.[2]?.disabled).toBe(true)
  })

  it('does not show minimap controls inside the search toolbar', async () => {
    mountPanel()
    applyPluginSettings({ ...DEFAULT_SETTINGS })
    openPanel(true)
    await nextTick()

    expect(host?.querySelector('button[title="显示文档缩略图"]')).toBeNull()
    expect(host?.querySelector('button[title="显示控制选项"]')).toBeNull()
    expect(host?.querySelector('.sfsr-options-panel')).toBeNull()
  })

  it('shows a prominent loading indicator while pending navigation is waiting for lazy-loaded content', async () => {
    mountPanel()
    applyPluginSettings({ ...DEFAULT_SETTINGS })
    searchReplaceState.navigationHint = '正在定位命中内容，等待编辑器继续加载...'
    openPanel(true)
    await nextTick()

    const status = host?.querySelector<HTMLElement>('.sfsr-status')
    const spinner = host?.querySelector<HTMLElement>('.sfsr-status__spinner')

    expect(status).not.toBeNull()
    expect(status?.classList.contains('sfsr-status--pending')).toBe(true)
    expect(status?.getAttribute('role')).toBe('status')
    expect(status?.getAttribute('aria-live')).toBe('polite')
    expect(spinner).not.toBeNull()
    expect(spinner?.getAttribute('aria-hidden')).toBe('true')
    expect(status?.textContent).toContain('正在定位命中内容，等待编辑器继续加载...')
  })

  it('renders the pending navigation hint on a separate line instead of joining it with the match preview', async () => {
    mountPanel()
    applyPluginSettings({ ...DEFAULT_SETTINGS })
    searchReplaceState.query = 'foo'
    searchReplaceState.matches = [{
      blockId: 'block-1',
      blockIndex: 0,
      blockType: 'NodeParagraph',
      end: 3,
      id: 'block-1:0:3',
      matchedText: 'foo',
      previewText: '前文 [foo] 后文',
      replaceable: true,
      rootId: 'root-1',
      start: 0,
    }] as any
    searchReplaceState.navigationHint = '正在定位命中内容，等待编辑器继续加载...'
    openPanel(true)
    await nextTick()

    const lines = Array.from(host?.querySelectorAll<HTMLElement>('.sfsr-status__line') ?? [])

    expect(lines).toHaveLength(2)
    expect(lines[0]?.textContent).toContain('前文 [foo] 后文')
    expect(lines[1]?.textContent).toContain('正在定位命中内容，等待编辑器继续加载...')
    expect(lines[1]?.classList.contains('sfsr-status__line--pending')).toBe(true)
  })

  it('shows a loading indicator while search results are still being computed', async () => {
    mountPanel()
    applyPluginSettings({ ...DEFAULT_SETTINGS })
    searchReplaceState.query = 'foo'
    ;(searchReplaceState as any).searching = true
    openPanel(true)
    await nextTick()

    const status = host?.querySelector<HTMLElement>('.sfsr-status')
    const spinner = host?.querySelector<HTMLElement>('.sfsr-status__spinner')
    const lines = Array.from(host?.querySelectorAll<HTMLElement>('.sfsr-status__line') ?? [])

    expect(status).not.toBeNull()
    expect(status?.classList.contains('sfsr-status--pending')).toBe(true)
    expect(spinner).not.toBeNull()
    expect(lines).toHaveLength(1)
    expect(lines[0]?.textContent).toContain('正在搜索并统计命中结果')
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

  it('clamps panel width and position after the viewport shrinks', async () => {
    mountPanel()
    applyPluginSettings({ ...DEFAULT_SETTINGS })
    searchReplaceState.panelPosition = { left: 320, top: 20 }
    openPanel(true)
    await nextTick()

    const panel = getPanelElement()

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 520,
    })
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 480,
    })
    Object.defineProperty(panel, 'offsetHeight', {
      configurable: true,
      value: 64,
    })

    window.dispatchEvent(new Event('resize'))
    await nextTick()

    expect(panel.style.width).toBe('504px')
    expect(searchReplaceState.panelPosition).toEqual({
      left: 8,
      top: 20,
    })
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
    ;(searchReplaceState as any).preserveCase = false
    searchReplaceState.panelPosition = null
    searchReplaceState.query = ''
    searchReplaceState.replacement = ''
    searchReplaceState.options = createSearchOptionsFromSettings(DEFAULT_SETTINGS)
    searchReplaceState.currentRootId = ''
    searchReplaceState.currentTitle = ''
    searchReplaceState.documentReadonly = false
    searchReplaceState.navigationHint = ''
    searchReplaceState.minimapBlocks = []
    searchReplaceState.matches = []
    searchReplaceState.currentIndex = 0
    searchReplaceState.error = ''
    searchReplaceState.busy = false
    searchReplaceState.searchableBlockCount = 0
  }
})
