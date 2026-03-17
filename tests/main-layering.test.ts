// @vitest-environment jsdom

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mount = vi.fn()
const unmount = vi.fn()
const bindPlugin = vi.fn()
const closePanel = vi.fn()
const initializeUiState = vi.fn(async () => undefined)
const unbindPlugin = vi.fn()

vi.mock('vue', () => ({
  createApp: vi.fn(() => ({
    mount,
    unmount,
  })),
}))

vi.mock('@/App.vue', () => ({
  default: {},
}))

vi.mock('@/features/search-replace/store', () => ({
  bindPlugin,
  closePanel,
  initializeUiState,
  unbindPlugin,
}))

describe('plugin host layering', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    mount.mockClear()
    unmount.mockClear()
    bindPlugin.mockClear()
    closePanel.mockClear()
    initializeUiState.mockClear()
    unbindPlugin.mockClear()
  })

  afterEach(async () => {
    const main = await import('@/main')
    main.destroy()
    document.body.innerHTML = ''
    delete (window as typeof window & { siyuan?: unknown }).siyuan
    vi.resetModules()
  })

  it('mounts the plugin host below the current SiYuan popup layer', async () => {
    window.siyuan = {
      zIndex: 208,
    } as any

    const { init } = await import('@/main')
    await init({} as any)

    const host = document.getElementById('siyuan-friendly-search-replace')

    expect(host).not.toBeNull()
    expect(host?.style.zIndex).toBe('207')
  })

  it('falls back to a low host layer when SiYuan does not expose a z-index', async () => {
    window.siyuan = {} as any

    const { init } = await import('@/main')
    await init({} as any)

    const host = document.getElementById('siyuan-friendly-search-replace')

    expect(host?.style.zIndex).toBe('1')
  })
})
