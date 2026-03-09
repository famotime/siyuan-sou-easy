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
  bindPlugin,
  closePanel,
  openPanel,
  searchReplaceState,
  unbindPlugin,
} from '@/features/search-replace/store'
import {
  DEFAULT_SETTINGS,
  createSearchOptionsFromSettings,
} from '@/settings'

describe('selection mode from panel interaction', () => {
  let host: HTMLDivElement | null = null
  let app: ReturnType<typeof createApp> | null = null

  beforeEach(() => {
    vi.useFakeTimers()
    resetState()
    document.body.innerHTML = `
      <div class="layout__wnd--active">
        <div class="protyle">
          <div class="protyle-background" data-node-id="root-1"></div>
          <div class="protyle-title" data-node-id="root-1"></div>
          <input class="protyle-title__input" value="Doc 1" />
          <div class="protyle-content">
            <div class="protyle-wysiwyg">
              <div data-node-id="block-1" data-type="NodeParagraph"><div contenteditable="true">foo bar foo</div></div>
            </div>
          </div>
        </div>
      </div>
    `
    bindPlugin({} as any)
    mountPanel()
  })

  afterEach(() => {
    closePanel()
    unbindPlugin()
    app?.unmount()
    host?.remove()
    document.body.innerHTML = ''
    window.getSelection()?.removeAllRanges()
    vi.useRealTimers()
    vi.restoreAllMocks()
    host = null
    app = null
  })

  it('clears the native selection after updating the selection-only scope so highlights become visible', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })
    searchReplaceState.query = 'foo'
    searchReplaceState.options.selectionOnly = true

    openPanel(true)
    await nextTick()
    vi.runOnlyPendingTimers()

    const textNode = document.querySelector('[data-node-id="block-1"] [contenteditable="true"]')?.firstChild as Text
    const range = document.createRange()
    range.setStart(textNode, 4)
    range.setEnd(textNode, 11)
    const selection = window.getSelection()!
    const clearSelectionSpy = vi.spyOn(selection, 'removeAllRanges')
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))

    vi.runOnlyPendingTimers()
    await nextTick()

    expect(searchReplaceState.matches).toHaveLength(1)
    expect(clearSelectionSpy).toHaveBeenCalledTimes(2)
  })

  it('immediately highlights matches inside the selected range after clicking the selection toggle', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })
    searchReplaceState.query = 'foo'

    openPanel(true)
    await nextTick()
    vi.runOnlyPendingTimers()

    const textNode = document.querySelector('[data-node-id="block-1"] [contenteditable="true"]')?.firstChild as Text
    const range = document.createRange()
    range.setStart(textNode, 4)
    range.setEnd(textNode, 11)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))

    const selectionButton = host?.querySelector<HTMLButtonElement>('button[title="仅在选中范围内查找和替换"]')
    selectionButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    vi.runOnlyPendingTimers()

    expect(searchReplaceState.options.selectionOnly).toBe(true)
    expect(searchReplaceState.matches).toHaveLength(1)
    expect(searchReplaceState.matches[0]?.start).toBe(8)
    expect(document.querySelector('[data-node-id="block-1"]')?.classList.contains('sfsr-block-current')).toBe(true)
  })

  it('shows a clear error when selection-only mode has no available selection', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })
    searchReplaceState.query = 'foo'
    searchReplaceState.options.selectionOnly = true

    openPanel(true)
    await nextTick()
    vi.runOnlyPendingTimers()

    expect(searchReplaceState.matches).toEqual([])
    expect(searchReplaceState.error).toBe('选区模式已开启，但当前没有可用选区')
  })

  it('searches within block selections when SiYuan marks blocks with protyle-wysiwyg--select', async () => {
    document.body.innerHTML = `
      <div class="layout__wnd--active">
        <div class="protyle">
          <div class="protyle-background" data-node-id="root-1"></div>
          <div class="protyle-title" data-node-id="root-1"></div>
          <input class="protyle-title__input" value="Doc 1" />
          <div class="protyle-content">
            <div class="protyle-wysiwyg">
              <div data-node-id="block-1" data-type="NodeParagraph" class="protyle-wysiwyg--select"><div contenteditable="true">foo bar</div></div>
              <div data-node-id="block-2" data-type="NodeParagraph" class="protyle-wysiwyg--select"><div contenteditable="true">bar foo</div></div>
            </div>
          </div>
        </div>
      </div>
    `

    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })
    searchReplaceState.query = 'foo'
    searchReplaceState.options.selectionOnly = true

    openPanel(true)
    await nextTick()
    vi.runOnlyPendingTimers()

    expect(searchReplaceState.error).toBe('')
    expect(searchReplaceState.matches).toHaveLength(2)
    expect(searchReplaceState.matches.map(match => match.blockId)).toEqual(['block-1', 'block-2'])
  })

  function mountPanel() {
    host = document.createElement('div')
    document.body.appendChild(host)
    app = createApp(App)
    app.mount(host)
  }

  function resetState() {
    searchReplaceState.visible = false
    searchReplaceState.replaceVisible = DEFAULT_SETTINGS.defaultReplaceVisible
    searchReplaceState.minimapVisible = false
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
