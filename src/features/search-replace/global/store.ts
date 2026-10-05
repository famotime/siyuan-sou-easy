import { reactive } from 'vue'
import { openTab } from 'siyuan'
import { getPluginInstance } from '@/plugin-instance'
import type {
  DocAggregateNode,
  GlobalMatchSnippet,
  GlobalSearchSortMode,
  GlobalSearchStateModel,
} from './types'
import { parseGlobalQuery } from './query-parser'
import { executeGlobalBlockQuery } from './kernel-query'
import {
  aggregateBlocksToDocs,
  sortDocAggregateNodes,
} from './doc-aggregator'

export const globalSearchState = reactive<GlobalSearchStateModel>({
  query: '',
  replacement: '',
  visible: false,
  replaceVisible: false,
  searching: false,
  replacing: false,
  error: undefined,
  statusMessage: undefined,
  options: {
    matchCase: false,
    wholeWord: false,
    useRegex: false,
    pinyin: false,
    fuzzy: false,
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
})

export function openGlobalSearch(replace = false) {
  globalSearchState.visible = true
  globalSearchState.replaceVisible = replace
}

export function closeGlobalSearch() {
  globalSearchState.visible = false
}

export function toggleGlobalReplace() {
  globalSearchState.replaceVisible = !globalSearchState.replaceVisible
}

export function setGlobalQuery(query: string) {
  globalSearchState.query = query
}

export function setGlobalReplacement(replacement: string) {
  globalSearchState.replacement = replacement
}

export function toggleGlobalOption(option: keyof GlobalSearchStateModel['options']) {
  globalSearchState.options[option] = !globalSearchState.options[option]
  if (globalSearchState.query.trim()) {
    executeGlobalSearch()
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
  const doc = globalSearchState.results.find(d => d.rootId === rootId)
  if (doc) {
    doc.collapsed = !doc.collapsed
  }
}

export function expandAllDocs() {
  globalSearchState.results.forEach(d => (d.collapsed = false))
}

export function collapseAllDocs() {
  globalSearchState.results.forEach(d => (d.collapsed = true))
}

export function toggleMatchSelection(matchId: string) {
  for (const doc of globalSearchState.results) {
    const match = doc.matches.find(m => m.matchId === matchId)
    if (match) {
      match.selectedForReplace = !match.selectedForReplace
      break
    }
  }
}

export function toggleDocSelection(rootId: string) {
  const doc = globalSearchState.results.find(d => d.rootId === rootId)
  if (!doc) return
  const anySelected = doc.matches.some(m => m.selectedForReplace)
  const targetState = !anySelected
  doc.matches.forEach(m => (m.selectedForReplace = targetState))
}

/**
 * 跨文档跳转并聚焦命中块
 */
export async function navigateToGlobalMatch(match: GlobalMatchSnippet) {
  globalSearchState.selectedMatchId = match.matchId
  const plugin = getPluginInstance()

  try {
    if (plugin?.app) {
      await openTab({
        app: plugin.app,
        doc: {
          id: match.blockId,
          action: ['cb-get-hl', 'cb-get-focus'],
        },
      })
    }
  } catch (error) {
    console.error('Failed to open tab for match:', error)
  }
}

/**
 * 执行全库检索
 */
export async function executeGlobalSearch() {
  const raw = globalSearchState.query.trim()
  if (!raw) {
    globalSearchState.results = []
    globalSearchState.totalDocCount = 0
    globalSearchState.totalMatchCount = 0
    globalSearchState.error = undefined
    globalSearchState.statusMessage = undefined
    return
  }

  globalSearchState.searching = true
  globalSearchState.error = undefined

  try {
    const parsed = parseGlobalQuery(raw)
    const effectiveFilters = {
      ...globalSearchState.filters,
      notebookId: parsed.notebook || globalSearchState.filters.notebookId,
      pathPrefix: parsed.path || globalSearchState.filters.pathPrefix,
      tags: Array.from(new Set([...(globalSearchState.filters.tags || []), ...parsed.tags])),
      types: Array.from(new Set([...(globalSearchState.filters.types || []), ...parsed.types])),
    }

    const keyword = parsed.textQuery || raw
    const sqlKeyword = globalSearchState.options.pinyin ? '' : keyword

    const blocks = await executeGlobalBlockQuery(sqlKeyword, effectiveFilters, {
      limit: 500,
      useRegex: globalSearchState.options.useRegex || globalSearchState.options.pinyin,
    })

    const docNodes = aggregateBlocksToDocs(blocks, keyword, {
      matchCase: globalSearchState.options.matchCase,
      wholeWord: globalSearchState.options.wholeWord,
      useRegex: globalSearchState.options.useRegex,
      pinyin: globalSearchState.options.pinyin,
    })

    const sorted = sortDocAggregateNodes(docNodes, globalSearchState.sortMode, keyword)

    globalSearchState.results = sorted
    globalSearchState.totalDocCount = sorted.length
    globalSearchState.totalMatchCount = sorted.reduce((sum, d) => sum + d.totalCount, 0)
    globalSearchState.statusMessage = `共命中 ${globalSearchState.totalDocCount} 篇文档，${globalSearchState.totalMatchCount} 处匹配`
  } catch (err: any) {
    globalSearchState.error = err.message || '搜索执行失败'
    globalSearchState.results = []
  } finally {
    globalSearchState.searching = false
  }
}
