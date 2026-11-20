import {
  describe,
  expect,
  it,
} from 'vitest'
import { createApp } from 'vue'
import { hasActiveGlobalFilters } from '@/features/search-replace/global/filter-utils'
import FilterPillsBar from '@/features/search-replace/global/ui/FilterPillsBar.vue'

describe('hasActiveGlobalFilters 共享谓词', () => {
  it('空过滤条件判定为未激活', () => {
    expect(hasActiveGlobalFilters({})).toBe(false)
    expect(hasActiveGlobalFilters({
      tags: [],
      types: [],
    })).toBe(false)
  })

  it('pathPrefix 单独激活（历史漂移缺陷回归场景）', () => {
    expect(hasActiveGlobalFilters({ pathPrefix: '/projects/' })).toBe(true)
  })

  it('notebookId / tags / types / dateRange 各自单独激活', () => {
    expect(hasActiveGlobalFilters({ notebookId: 'nb-1' })).toBe(true)
    expect(hasActiveGlobalFilters({ tags: ['tag'] })).toBe(true)
    expect(hasActiveGlobalFilters({ types: ['p'] })).toBe(true)
    expect(hasActiveGlobalFilters({ dateRange: { start: '20260101000000' } })).toBe(true)
  })

  it('空字符串与空数组不视为激活', () => {
    expect(hasActiveGlobalFilters({
      notebookId: '',
      pathPrefix: '',
      tags: [],
      types: [],
    })).toBe(false)
    expect(hasActiveGlobalFilters({ dateRange: {} })).toBe(false)
  })
})

describe('filterPillsBar 重置过滤按钮可见性（RF-101）', () => {
  function mountBar(filters: Parameters<typeof hasActiveGlobalFilters>[0]) {
    const container = document.createElement('div')
    const app = createApp(FilterPillsBar, { filters })
    app.mount(container)
    return {
      container,
      unmount: () => app.unmount(),
    }
  }

  it('仅 pathPrefix 过滤时显示重置按钮', () => {
    const {
      container,
      unmount,
    } = mountBar({ pathPrefix: '/projects/' })
    expect(container.querySelector('.sfsr-pill-reset')).not.toBeNull()
    unmount()
  })

  it('无任何过滤时不显示重置按钮', () => {
    const {
      container,
      unmount,
    } = mountBar({})
    expect(container.querySelector('.sfsr-pill-reset')).toBeNull()
    unmount()
  })
})
