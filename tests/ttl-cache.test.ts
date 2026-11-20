import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { createTtlCache } from '@/features/search-replace/ttl-cache'

// RF-204：统一 index.ts（运行时快捷键）与 search-controller（文档只读态）的
// 手写 TTL 缓存为共享 createTtlCache。

describe('createTtlCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-21T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('tTL 内命中缓存，过期后返回 undefined', () => {
    const cache = createTtlCache<string>(5000)
    cache.set('k', 'v')
    expect(cache.get('k')).toBe('v')

    vi.advanceTimersByTime(5001)
    expect(cache.get('k')).toBeUndefined()
    // 过期条目被清除
    expect(cache.has('k')).toBe(false)
  })

  it('falsy 值（如 false）不视为缓存缺失', () => {
    const cache = createTtlCache<boolean>(5000)
    cache.set('ro', false)
    expect(cache.has('ro')).toBe(true)
    expect(cache.get('ro')).toBe(false)
  })

  it('invalidate 可清除单键或全部', () => {
    const cache = createTtlCache<number>(5000)
    cache.set('a', 1)
    cache.set('b', 2)

    cache.invalidate('a')
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe(2)

    cache.invalidate()
    expect(cache.get('b')).toBeUndefined()
  })

  it('set 可覆盖同键并刷新过期时间', () => {
    const cache = createTtlCache<number>(5000)
    cache.set('k', 1)
    vi.advanceTimersByTime(3000)
    cache.set('k', 2)
    vi.advanceTimersByTime(3000)
    expect(cache.get('k')).toBe(2)
  })
})
