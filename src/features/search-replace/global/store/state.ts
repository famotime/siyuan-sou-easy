import type {
  GlobalSearchSortMode,
  GlobalSearchStateModel,
} from '../types'
import { reactive } from 'vue'
import { createRevisionGuard } from '@/features/search-replace/store/revision'
import { sortDocAggregateNodes } from '../doc-aggregator'
import { parseGlobalQuery } from '../query-parser'

// 拆分自 global/store.ts（RF-106）：全库搜索响应式状态、工厂与 UI 级动作。
// DOM 导航高亮见 navigation.ts，搜索执行见 search-actions.ts。

export function createInitialGlobalSearchState(): GlobalSearchStateModel {
  return {
    query: '',
    searchedQuery: '',
    replacement: '',
    replaceVisible: false,
    searching: false,
    error: undefined,
    statusMessage: undefined,
    options: {
      matchCase: false,
      wholeWord: false,
      useRegex: false,
      pinyin: false,
      docOnly: true,
    },
    filters: {
      tags: [],
      types: [],
    },
    sortMode: 'relevance',
    results: [],
    totalMatchCount: 0,
    totalDocCount: 0,
    selectedMatchId: undefined,
  }
}

export const globalSearchState = reactive<GlobalSearchStateModel>(
  createInitialGlobalSearchState(),
)

export function resetGlobalSearchState() {
  Object.assign(globalSearchState, createInitialGlobalSearchState())
}

export const globalSearchRevision = createRevisionGuard()

export function clearGlobalSearchResults() {
  // 结果被清除意味着任何 in-flight 搜索的产物都已过时，使其 revision 失效，
  // 防止旧搜索完成时把旧查询的结果写回已清空的状态。
  globalSearchRevision.invalidate()
  globalSearchState.results = []
  globalSearchState.totalDocCount = 0
  globalSearchState.totalMatchCount = 0
  globalSearchState.statusMessage = undefined
  globalSearchState.error = undefined
}

export function toggleGlobalReplace() {
  globalSearchState.replaceVisible = !globalSearchState.replaceVisible
}

export function setGlobalQuery(query: string) {
  globalSearchState.query = query
  if (query.trim() !== globalSearchState.searchedQuery) {
    clearGlobalSearchResults()
  }
}

export function setGlobalSortMode(mode: GlobalSearchSortMode) {
  globalSearchState.sortMode = mode
  if (globalSearchState.results.length > 0) {
    const parsed = parseGlobalQuery(globalSearchState.query)
    globalSearchState.results = sortDocAggregateNodes(
      globalSearchState.results,
      mode,
      parsed.textQuery,
    )
  }
}

export function toggleDocCollapse(rootId: string) {
  const doc = globalSearchState.results.find((d) => d.rootId === rootId)
  if (doc) {
    doc.collapsed = !doc.collapsed
  }
}

export function expandAllDocs() {
  globalSearchState.results.forEach((d) => (d.collapsed = false))
}

export function collapseAllDocs() {
  globalSearchState.results.forEach((d) => (d.collapsed = true))
}

export function toggleAllDocsCollapse() {
  const isAllCollapsed = globalSearchState.results.length > 0
    && globalSearchState.results.every((d) => d.collapsed)
  if (isAllCollapsed) {
    expandAllDocs()
  } else {
    collapseAllDocs()
  }
}
