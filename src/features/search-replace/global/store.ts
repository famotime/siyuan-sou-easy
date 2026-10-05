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

export function toggleAllDocsCollapse() {
  const isAllCollapsed = globalSearchState.results.length > 0
    && globalSearchState.results.every(d => d.collapsed)
  if (isAllCollapsed) {
    expandAllDocs()
  } else {
    collapseAllDocs()
  }
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
 * 在目标表格块的 DOM 中，精准找到对应的 <tr> 节点
 */
export function findTargetTableRowElement(
  rows: HTMLElement[],
  rowIndex?: number,
  rowText?: string,
  keyword?: string,
  matchedCellText?: string,
): HTMLElement | null {
  if (!rows.length) return null

  // 1. 最高优先级：直接按 1:1 对应的 rowIndex 索引查找并校验内容
  if (typeof rowIndex === 'number' && rows[rowIndex]) {
    const candidate = rows[rowIndex]
    const content = candidate.textContent || ''
    // 校验：若没有指定关键词，或者内容包含关键词，或者内容包含命中单元格
    if (!keyword || content.includes(keyword) || (matchedCellText && content.includes(matchedCellText))) {
      return candidate
    }
  }

  // 2. 第二优先级：如果索引处未匹配成功（防御思源未来可能的特殊 DOM 结构变化），
  // 使用特征打分法（绝不能盲目使用 rows.find 拿第一个包含 keyword 的行！）
  let bestRow: HTMLElement | null = null
  let maxScore = -1

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const text = r.textContent || ''
    if (keyword && !text.includes(keyword)) {
      continue // 必须至少包含搜索关键词
    }

    let score = 10
    // 如果包含命中单元格特征文本，大幅加分
    if (matchedCellText && text.includes(matchedCellText)) {
      score += 50
    }
    // 如果 rowText 中包含的同一行其他列文本也出现在该行中，按命中加分
    if (rowText) {
      const parts = rowText.split(' | ').filter(p => p.length >= 2)
      for (const part of parts) {
        if (text.includes(part)) {
          score += 20
        }
      }
    }
    // 与预期 rowIndex 距离越近，加一定的位置偏置分（防止远距离误匹配）
    if (typeof rowIndex === 'number') {
      const distance = Math.abs(i - rowIndex)
      score += Math.max(0, 30 - distance * 2)
    }

    if (score > maxScore) {
      maxScore = score
      bestRow = r
    }
  }

  if (bestRow) {
    return bestRow
  }

  // 3. 兜底：如果实在没匹配上特征，但传入了 rowIndex 且在合法范围
  if (typeof rowIndex === 'number' && rows[rowIndex]) {
    return rows[rowIndex]
  }

  return null
}

/**
 * 将目标表格行平滑滚动至 Protyle 编辑器视口正中心
 */
export function scrollToCenterTableRow(targetRow: HTMLElement) {
  const scrollContainer = targetRow.closest('.protyle-content') as HTMLElement | null
  if (scrollContainer) {
    const containerRect = scrollContainer.getBoundingClientRect()
    const rowRect = targetRow.getBoundingClientRect()
    const currentScrollTop = scrollContainer.scrollTop
    // 计算将 targetRow 垂直居中的 scrollTop
    const targetScrollTop =
      currentScrollTop +
      (rowRect.top - containerRect.top) -
      containerRect.height / 2 +
      rowRect.height / 2

    scrollContainer.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: 'smooth',
    })
  } else {
    targetRow.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    })
  }
}

/**
 * 定位并平滑滚动高亮具体表格行
 */
export function scrollAndHighlightTableRow(
  tableBlockId: string,
  rowIndex?: number,
  rowText?: string,
  keyword?: string,
  matchedCellText?: string,
  attempt = 0,
) {
  if (typeof document === 'undefined') return

  const tableBlock = document.querySelector<HTMLElement>(`[data-node-id="${tableBlockId}"]`)
  if (!tableBlock) {
    if (attempt < 10) {
      setTimeout(() => {
        scrollAndHighlightTableRow(tableBlockId, rowIndex, rowText, keyword, matchedCellText, attempt + 1)
      }, 70)
    }
    return
  }

  const rows = Array.from(tableBlock.querySelectorAll<HTMLElement>('tr, .table__row'))
  if (!rows.length) return

  const targetRow = findTargetTableRowElement(rows, rowIndex, rowText, keyword, matchedCellText)
  if (!targetRow) return

  // 立即触发一次居中滚动
  scrollToCenterTableRow(targetRow)

  // 施加高亮闪烁动画
  const HIGHLIGHT_CLASS = 'sfsr-table-row-target-highlight'
  targetRow.classList.remove(HIGHLIGHT_CLASS)
  void targetRow.offsetWidth
  targetRow.classList.add(HIGHLIGHT_CLASS)

  setTimeout(() => {
    targetRow.classList.remove(HIGHLIGHT_CLASS)
  }, 2200)

  // 针对思源 openTab 异步处理后的时序抗干扰校验：
  // 350ms 后再次校验 targetRow 是否偏离视口中心较多；若被思源自带的 cb-get-focus 重新拉回了顶部，再次执行居中滚动纠偏
  setTimeout(() => {
    const scrollContainer = targetRow.closest('.protyle-content') as HTMLElement | null
    if (scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect()
      const rowRect = targetRow.getBoundingClientRect()
      const centerY = containerRect.top + containerRect.height / 2
      const rowCenterY = rowRect.top + rowRect.height / 2
      if (Math.abs(centerY - rowCenterY) > 150) {
        scrollToCenterTableRow(targetRow)
      }
    }
  }, 350)
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

      // 若为表格命中，精确滚动并高亮至具体表格行（避开 openTab 同步回调冲突，延时执行）
      if (match.blockType === 't' && (typeof match.tableRowIndex === 'number' || match.tableRowText)) {
        setTimeout(() => {
          scrollAndHighlightTableRow(
            match.blockId,
            match.tableRowIndex,
            match.tableRowText,
            match.matchedText,
            match.matchedCellText,
          )
        }, 120)
      }
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

    const queryLimit = globalSearchState.options.pinyin ? 2000 : 500
    const blocks = await executeGlobalBlockQuery(sqlKeyword, effectiveFilters, {
      limit: queryLimit,
      useRegex: globalSearchState.options.useRegex || globalSearchState.options.pinyin,
      docOnly: globalSearchState.options.docOnly,
    })

    const docNodes = aggregateBlocksToDocs(blocks, keyword, {
      matchCase: globalSearchState.options.matchCase,
      wholeWord: globalSearchState.options.wholeWord,
      useRegex: globalSearchState.options.useRegex,
      pinyin: globalSearchState.options.pinyin,
      docOnly: globalSearchState.options.docOnly,
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
