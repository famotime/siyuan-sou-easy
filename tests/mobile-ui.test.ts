// @vitest-environment jsdom

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { createApp, nextTick } from 'vue'
import App from '@/App.vue'
import * as environmentModule from '@/features/search-replace/plugin-environment'
import {
  applyPluginSettings,
  bindPlugin,
  closePanel,
  openPanel,
  resetSearchReplaceState,
  toggleReplaceVisible,
  unbindPlugin,
} from '@/features/search-replace/store'
import { DEFAULT_SETTINGS } from '@/settings'

describe('mobile UI simplified controls', () => {
  let host: HTMLDivElement | null = null
  let app: ReturnType<typeof createApp> | null = null

  function mountPanel() {
    host = document.createElement('div')
    document.body.appendChild(host)
    app = createApp(App)
    app.mount(host)
  }

  function resetState() {
    resetSearchReplaceState()
  }

  beforeEach(() => {
    vi.useFakeTimers()
    resetState()
    bindPlugin({} as any)
  })

  afterEach(() => {
    app?.unmount()
    host?.remove()
    closePanel()
    unbindPlugin()
    vi.clearAllTimers()
    vi.restoreAllMocks()
    vi.useRealTimers()
    host = null
    app = null
  })

  it('hides desktop option toggles but renders close button on mobile environment', async () => {
    vi.spyOn(environmentModule, 'detectPluginEnvironment').mockReturnValue({
      isBrowser: false,
      isElectron: false,
      isInWindow: false,
      isLocal: true,
      isMobile: true,
      // SyFrontendTypes 为全局环境枚举（仅作类型使用，运行时无此绑定），局部断言保持原字面量
      platform: 'mobile' as SyFrontendTypes,
    })

    mountPanel()
    applyPluginSettings({ ...DEFAULT_SETTINGS })
    openPanel(true)
    await nextTick()

    // Panel should have mobile class
    const panel = host?.querySelector('.sfsr-panel')
    expect(panel?.classList.contains('sfsr-panel--mobile')).toBe(true)

    // Resize handle should be hidden
    expect(host?.querySelector('.sfsr-resize-handle')).toBeNull()

    // Search toggles (Aa, wholeWord, regex) should be hidden
    expect(host?.querySelector('.sfsr-field__toggles')).toBeNull()

    // Count should still be visible
    expect(host?.querySelector('.sfsr-count')).not.toBeNull()

    // Prev, Next and Close buttons should exist (3 action buttons in main toolbar)
    const actions = host?.querySelectorAll('.sfsr-action')
    expect(actions?.length).toBe(3)
  })

  it('renders replace, skip, and replaceAll buttons on mobile when replace row is expanded', async () => {
    vi.spyOn(environmentModule, 'detectPluginEnvironment').mockReturnValue({
      isBrowser: false,
      isElectron: false,
      isInWindow: false,
      isLocal: true,
      isMobile: true,
      // SyFrontendTypes 为全局环境枚举（仅作类型使用，运行时无此绑定），局部断言保持原字面量
      platform: 'mobile' as SyFrontendTypes,
    })

    mountPanel()
    applyPluginSettings({ ...DEFAULT_SETTINGS })
    openPanel(true)
    toggleReplaceVisible()
    await nextTick()

    const secondaryRow = host?.querySelector('.sfsr-row--secondary')
    expect(secondaryRow).not.toBeNull()

    // Preserve case toggle in replace row should be hidden
    expect(secondaryRow?.querySelector('.sfsr-field__toggles')).toBeNull()

    // In replace row, ReplaceCurrent, SkipCurrent, ReplaceAll buttons should exist (3 action buttons)
    const replaceActions = secondaryRow?.querySelectorAll('.sfsr-action')
    expect(replaceActions?.length).toBe(3)
  })
})
