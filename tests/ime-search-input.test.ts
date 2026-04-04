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
  closePanel,
  openPanel,
  searchReplaceState,
} from '@/features/search-replace/store'
import {
  DEFAULT_SETTINGS,
  createSearchOptionsFromSettings,
} from '@/settings'

describe('search input ime handling', () => {
  let host: HTMLDivElement | null = null
  let app: ReturnType<typeof createApp> | null = null

  beforeEach(async () => {
    vi.useFakeTimers()
    resetState()
    host = document.createElement('div')
    document.body.appendChild(host)
    app = createApp(App)
    app.mount(host)
    openPanel(true)
    await nextTick()
  })

  afterEach(() => {
    app?.unmount()
    host?.remove()
    closePanel()
    vi.clearAllTimers()
    vi.useRealTimers()
    host = null
    app = null
  })

  it('commits the find query on composition end without requiring an extra click', async () => {
    const input = host?.querySelector<HTMLInputElement>('.sfsr-input')

    expect(input).not.toBeNull()

    input!.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    input!.value = '飞书'
    input!.dispatchEvent(new CompositionEvent('compositionend', {
      bubbles: true,
      data: '飞书',
    }))
    await nextTick()

    expect(searchReplaceState.query).toBe('飞书')
  })

  it('clears the stale counter immediately when deleting characters from the find query', async () => {
    searchReplaceState.visible = true
    searchReplaceState.query = 'foobar'
    searchReplaceState.matches = [
      {
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
      },
      {
        blockId: 'block-1',
        blockIndex: 0,
        blockType: 'NodeParagraph',
        end: 10,
        id: 'block-1:7:10',
        matchedText: 'foo',
        previewText: 'bar [foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 7,
      },
    ] as any
    searchReplaceState.currentIndex = 1
    await nextTick()

    const input = host?.querySelector<HTMLInputElement>('.sfsr-input')
    const counter = host?.querySelector<HTMLElement>('.sfsr-count')

    expect(input).not.toBeNull()
    expect(counter?.textContent?.trim()).toBe('2 / 2')

    input!.value = 'foo'
    input!.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'deleteContentBackward',
    }))
    await nextTick()

    expect(searchReplaceState.query).toBe('foo')
    expect(counter?.textContent?.trim()).toBe('0 / 0')
  })
})

function resetState() {
  searchReplaceState.visible = false
  searchReplaceState.replaceVisible = DEFAULT_SETTINGS.defaultReplaceVisible
  ;(searchReplaceState as any).minimapVisible = false
  ;(searchReplaceState as any).preserveCase = false
  searchReplaceState.panelPosition = null
  searchReplaceState.settings = { ...DEFAULT_SETTINGS }
  searchReplaceState.query = ''
  searchReplaceState.replacement = ''
  searchReplaceState.options = createSearchOptionsFromSettings(DEFAULT_SETTINGS)
  searchReplaceState.currentRootId = ''
  searchReplaceState.currentTitle = ''
  searchReplaceState.navigationHint = ''
  searchReplaceState.minimapBlocks = []
  searchReplaceState.matches = []
  searchReplaceState.currentIndex = 0
  searchReplaceState.error = ''
  searchReplaceState.busy = false
  searchReplaceState.searchableBlockCount = 0
}
