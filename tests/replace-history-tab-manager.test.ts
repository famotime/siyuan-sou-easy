import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  destroyReplaceHistoryTab,
  initReplaceHistoryTab,
} from '@/features/search-replace/global/history-tab-manager'

const unmountSpy = vi.fn()

vi.mock('vue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue')>()
  return {
    ...actual,
    createApp: vi.fn((...args: Parameters<typeof actual.createApp>) => {
      const app = actual.createApp(...args)
      const originalUnmount = app.unmount.bind(app)
      app.unmount = vi.fn(() => {
        unmountSpy()
        originalUnmount()
      }) as typeof app.unmount
      return app
    }),
  }
})

describe('replace history tab manager lifecycle', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    unmountSpy.mockClear()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('unmounts the previous app when the same element is re-initialized', () => {
    const element = document.createElement('div')
    document.body.appendChild(element)

    initReplaceHistoryTab(element)
    expect(unmountSpy).not.toHaveBeenCalled()

    // 思源对同一 tab element 重放 init（分屏重载）：旧 app 必须先卸载，
    // 否则其组件副作用永久泄漏
    initReplaceHistoryTab(element)
    expect(unmountSpy).toHaveBeenCalledTimes(1)

    initReplaceHistoryTab(element)
    expect(unmountSpy).toHaveBeenCalledTimes(2)

    destroyReplaceHistoryTab(element)
    expect(unmountSpy).toHaveBeenCalledTimes(3)
  })

  it('clears the element content on destroy', () => {
    const element = document.createElement('div')
    document.body.appendChild(element)

    initReplaceHistoryTab(element)
    expect(element.children.length).toBe(1)

    destroyReplaceHistoryTab(element)
    expect(element.innerHTML).toBe('')
  })
})
