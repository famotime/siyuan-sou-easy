import {
  aggregateBlocksToDocs,
  sortDocAggregateNodes,
} from '../doc-aggregator'
import { executeGlobalBlockQuery } from '../kernel-query'
import {
  parseDateFilterValue,
  parseGlobalQuery,
} from '../query-parser'
import {
  clearGlobalSearchResults,
  globalSearchRevision,
  globalSearchState,
} from './state'

// 拆分自 global/store.ts（RF-106）：全库搜索执行与触发型动作。
// 状态与 UI 动作见 state.ts，DOM 导航高亮见 navigation.ts。

// spinner 语义是"存在进行中的搜索"，用 in-flight 计数驱动；结果写入用 revision 守卫。
// 两者分离：过期搜索结束时不会误关新搜索的 spinner，也不会让已死搜索的 spinner 卡住。
let inFlightSearchCount = 0

export function toggleGlobalOption(option: keyof typeof globalSearchState.options) {
  globalSearchState.options[option] = !globalSearchState.options[option]
  const current = globalSearchState.query.trim()
  if (current && current === globalSearchState.searchedQuery) {
    executeGlobalSearch()
  }
}

/**
 * 执行全库检索
 */
export async function executeGlobalSearch() {
  const raw = globalSearchState.query.trim()
  if (!raw) {
    globalSearchState.searchedQuery = ''
    clearGlobalSearchResults()
    return
  }

  const revision = globalSearchRevision.next()
  inFlightSearchCount += 1
  globalSearchState.searching = true
  globalSearchState.error = undefined

  try {
    const parsed = parseGlobalQuery(raw)
    const parsedDateRange = parseDateFilterValue(parsed.dateFilter)
    const effectiveFilters = {
      ...globalSearchState.filters,
      notebookId: parsed.notebook || globalSearchState.filters.notebookId,
      pathPrefix: parsed.path || globalSearchState.filters.pathPrefix,
      tags: Array.from(new Set([...(globalSearchState.filters.tags || []), ...parsed.tags])),
      types: Array.from(new Set([...(globalSearchState.filters.types || []), ...parsed.types])),
      // `updated:` 等查询语法优先于时间胶囊过滤
      dateRange: parsedDateRange ?? globalSearchState.filters.dateRange,
    }

    // 类型过滤与"仅文档"互斥：选中类型胶囊或使用 type: 语法时自动关闭仅文档，
    // 否则 SQL 强制 type='d' 会静默吞掉类型过滤
    const effectiveDocOnly = globalSearchState.options.docOnly && effectiveFilters.types.length === 0

    const keyword = parsed.textQuery || raw
    const sqlKeyword = globalSearchState.options.pinyin ? '' : keyword

    const queryLimit = globalSearchState.options.pinyin ? 2000 : 500
    const blocks = await executeGlobalBlockQuery(sqlKeyword, effectiveFilters, {
      limit: queryLimit,
      useRegex: globalSearchState.options.useRegex || globalSearchState.options.pinyin,
      docOnly: effectiveDocOnly,
      parsedQuery: globalSearchState.options.pinyin ? undefined : parsed,
    })
    if (globalSearchRevision.isStale(revision)) {
      return
    }

    const docNodes = aggregateBlocksToDocs(blocks, keyword, {
      matchCase: globalSearchState.options.matchCase,
      wholeWord: globalSearchState.options.wholeWord,
      useRegex: globalSearchState.options.useRegex,
      pinyin: globalSearchState.options.pinyin,
      docOnly: effectiveDocOnly,
      parsedQuery: parsed,
    })

    const sorted = sortDocAggregateNodes(docNodes, globalSearchState.sortMode, keyword)

    globalSearchState.searchedQuery = raw
    globalSearchState.results = sorted
    globalSearchState.totalDocCount = sorted.length
    globalSearchState.totalMatchCount = sorted.reduce((sum, d) => sum + d.totalCount, 0)
    globalSearchState.statusMessage = `共命中 ${globalSearchState.totalDocCount} 篇文档，${globalSearchState.totalMatchCount} 处匹配`
  } catch (err: any) {
    // 过期搜索的异常同样丢弃，避免覆盖新搜索的状态
    if (globalSearchRevision.isStale(revision)) {
      return
    }
    globalSearchState.error = err.message || '搜索执行失败'
    globalSearchState.results = []
    globalSearchState.searchedQuery = raw
  } finally {
    inFlightSearchCount = Math.max(0, inFlightSearchCount - 1)
    if (inFlightSearchCount === 0) {
      globalSearchState.searching = false
    }
  }
}
