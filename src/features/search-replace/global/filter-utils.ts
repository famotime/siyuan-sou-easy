import type { GlobalSearchFilters } from './types'

/**
 * 判定全库搜索过滤条件是否含有任一激活项。
 *
 * 供 Dock 主视图与 FilterPillsBar 共用：历史上两处各写一份谓词，
 * PillsBar 漏判 pathPrefix 导致"重置过滤"按钮在该场景下不显示（RF-101）。
 */
export function hasActiveGlobalFilters(filters: GlobalSearchFilters): boolean {
  return Boolean(
    filters.notebookId
    || filters.pathPrefix
    || (filters.tags && filters.tags.length > 0)
    || (filters.types && filters.types.length > 0)
    || filters.dateRange?.start,
  )
}
