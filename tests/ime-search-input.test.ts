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
