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
import { searchReplaceState } from '@/features/search-replace/store'
import { DEFAULT_SETTINGS, createSearchOptionsFromSettings } from '@/settings'

describe('search panel minimap', () => {
  let host: HTMLDivElement | null = null
  let app: ReturnType<typeof createApp> | null = null
  let scrollTop = 300

  beforeEach(() => {
    resetState()
    scrollTop = 300
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="block-1" data-type="NodeParagraph"><div contenteditable="true">First block</div></div>
            <div data-node-id="block-2" data-type="NodeParagraph"><div contenteditable="true">Second block</div></div>
          </div>
        </div>
      </div>
    `

    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    const blockOne = document.querySelector<HTMLElement>('[data-node-id="block-1"]')!
    const blockTwo = document.querySelector<HTMLElement>('[data-node-id="block-2"]')!

    Object.defineProperty(scrollContainer, 'clientHeight', {
      configurable: true,
      value: 300,
    })
    Object.defineProperty(scrollContainer, 'scrollHeight', {
      configurable: true,
      value: 1200,
    })
    Object.defineProperty(scrollContainer, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value
      },
    })
    scrollContainer.scrollTo = vi.fn(({ top }: { top?: number }) => {
      scrollTop = top ?? scrollTop
    }) as any

    vi.spyOn(scrollContainer, 'getBoundingClientRect').mockReturnValue({
      bottom: 420,
      height: 300,
      left: 100,
      right: 520,
      toJSON: () => ({}),
      top: 120,
      width: 420,
      x: 100,
      y: 120,
    })
    vi.spyOn(blockOne, 'getBoundingClientRect').mockReturnValue({
      bottom: 240,
      height: 80,
      left: 120,
      right: 500,
      toJSON: () => ({}),
      top: 160,
      width: 380,
      x: 120,
      y: 160,
    })
    vi.spyOn(blockTwo, 'getBoundingClientRect').mockReturnValue({
      bottom: 360,
      height: 100,
      left: 120,
      right: 500,
      toJSON: () => ({}),
      top: 260,
      width: 380,
      x: 120,
      y: 260,
    })
  })

  afterEach(() => {
    app?.unmount()
    host?.remove()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    host = null
    app = null
  })

  it('renders viewport and keyword markers when minimap is enabled', async () => {
    mountPanel()
    searchReplaceState.visible = true
    searchReplaceState.minimapVisible = true
    searchReplaceState.currentRootId = 'root-1'
    searchReplaceState.currentTitle = 'Doc 1'
    searchReplaceState.matches = [
      {
        blockId: 'block-1',
        blockIndex: 0,
        blockType: 'NodeParagraph',
        end: 5,
        id: 'block-1:0:5',
        matchedText: 'First',
        previewText: '[First] block',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
      },
      {
        blockId: 'block-2',
        blockIndex: 1,
        blockType: 'NodeParagraph',
        end: 6,
        id: 'block-2:0:6',
        matchedText: 'Second',
        previewText: '[Second] block',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
      },
    ]
    searchReplaceState.currentIndex = 1

    await nextTick()
    await nextTick()

    const minimap = host?.querySelector<HTMLElement>('.sfsr-minimap')
    const viewport = host?.querySelector<HTMLElement>('.sfsr-minimap__viewport')
    const markers = host?.querySelectorAll<HTMLElement>('.sfsr-minimap__marker')
    const currentMarker = host?.querySelector<HTMLElement>('.sfsr-minimap__marker--current')

    expect(minimap).not.toBeNull()
    expect(viewport).not.toBeNull()
    expect(markers).toHaveLength(2)
    expect(currentMarker).not.toBeNull()
  })

  it('jumps to another document position when clicking the minimap', async () => {
    mountPanel()
    searchReplaceState.visible = true
    searchReplaceState.minimapVisible = true
    searchReplaceState.currentRootId = 'root-1'
    searchReplaceState.currentTitle = 'Doc 1'

    await nextTick()
    await nextTick()

    const track = host?.querySelector<HTMLElement>('.sfsr-minimap__track')

    expect(track).not.toBeNull()
    expect(scrollTop).toBe(300)

    track?.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      clientX: 10,
      clientY: 300,
    }))

    expect(scrollTop).toBeGreaterThan(300)
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
