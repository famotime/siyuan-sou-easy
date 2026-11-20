// 拆分自 index.ts（运行时快捷键缓存）与 store/search-controller.ts
// （文档只读态缓存）的手写 TTL 缓存（RF-204 收敛）。

export interface TtlCache<T> {
  get: (key: string) => T | undefined
  has: (key: string) => boolean
  set: (key: string, value: T) => void
  /** 清除单键；缺省键时清空全部 */
  invalidate: (key?: string) => void
}

export function createTtlCache<T>(ttlMs: number): TtlCache<T> {
  const entries = new Map<string, { expiresAt: number, value: T }>()

  function get(key: string): T | undefined {
    const entry = entries.get(key)
    if (entry && Date.now() < entry.expiresAt) {
      return entry.value
    }

    entries.delete(key)
    return undefined
  }

  return {
    get,
    has: (key) => entries.has(key) && get(key) !== undefined,
    set: (key, value) => {
      entries.set(key, {
        expiresAt: Date.now() + ttlMs,
        value,
      })
    },
    invalidate: (key?) => {
      if (key === undefined) {
        entries.clear()
      } else {
        entries.delete(key)
      }
    },
  }
}
