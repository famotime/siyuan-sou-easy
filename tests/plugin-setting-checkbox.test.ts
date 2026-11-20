import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { createCheckboxElement } from '@/features/search-replace/plugin-setting-elements'

describe('settings checkbox failure feedback', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps the new value when the change handler succeeds', async () => {
    const onChange = vi.fn(async () => undefined)
    const input = createCheckboxElement(false, onChange)

    input.checked = true
    input.dispatchEvent(new Event('change'))
    await Promise.resolve()
    await Promise.resolve()

    expect(onChange).toHaveBeenCalledWith(true)
    expect(input.checked).toBe(true)
  })

  it('reverts the switch when the change handler reports failure', async () => {
    const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onChange = vi.fn(async () => {
      throw new Error('save failed')
    })
    const input = createCheckboxElement(false, onChange)

    input.checked = true
    input.dispatchEvent(new Event('change'))
    await Promise.resolve()
    await Promise.resolve()

    // 写盘失败：开关回退为原值，不再虚报成功（此前 rejection 无人捕获）
    expect(input.checked).toBe(false)
    expect(warnSpy).toHaveBeenCalled()
  })
})
