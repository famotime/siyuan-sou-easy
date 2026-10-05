import { reactive } from 'vue'
import { openTab, type TProtyleAction } from 'siyuan'
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
 * 判断目标块是否已经存在于当前可见的活动编辑器中
 */
export function isBlockVisibleInActiveEditor(blockId: string): HTMLElement | null {
  if (typeof document === 'undefined') return null

  // 1. 优先在当前激活的窗口中查找
  const activeBlock = document.querySelector<HTMLElement>(
    `.layout__wnd--active .protyle:not(.fn__none) [data-node-id="${blockId}"]`,
  )
  if (activeBlock && activeBlock.offsetParent !== null) {
    return activeBlock
  }

  // 2. 其次在任意未隐藏的可见 Protyle 编辑器中查找
  const visibleBlocks = Array.from(
    document.querySelectorAll<HTMLElement>(
      `.protyle:not(.fn__none) [data-node-id="${blockId}"]`,
    ),
  )
  for (const block of visibleBlocks) {
    if (block.offsetParent !== null) {
      return block
    }
  }

  return null
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

  // 解析并提取有效关键词列表（兼容多处匹配如 "深圳, 深圳"）
  const keywords = keyword
    ? keyword
        .split(/,\s*/)
        .map(k => k.trim())
        .filter(Boolean)
    : []

  const containsAnyKeyword = (text: string) => {
    if (!keywords.length) return true
    return keywords.some(k => text.includes(k))
  }

  // 1. 最高优先级：直接按 1:1 对应的 rowIndex 索引查找并校验内容
  if (typeof rowIndex === 'number' && rows[rowIndex]) {
    const candidate = rows[rowIndex]
    const content = candidate.textContent || ''
    // 校验：若没有指定关键词，或者内容包含任一关键词，或者内容包含命中单元格特征
    if (containsAnyKeyword(content) || (matchedCellText && content.includes(matchedCellText))) {
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
    if (keywords.length && !containsAnyKeyword(text)) {
      continue // 必须至少包含搜索关键词之一
    }

    let score = 10
    // 如果包含命中单元格特征文本，大幅加分
    if (matchedCellText && text.includes(matchedCellText)) {
      score += 50
    }
    // 如果 rowText 中包含的同一行其他列文本也出现在该行中，按命中加分
    if (rowText) {
      const parts = rowText.split(' | ').map(p => p.trim()).filter(p => p.length >= 2)
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
  try {
    targetRow.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    })
  } catch {
    const scrollContainer = targetRow.closest('.protyle-content') as HTMLElement | null
    if (scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect()
      const rowRect = targetRow.getBoundingClientRect()
      const currentScrollTop = scrollContainer.scrollTop
      const targetScrollTop =
        currentScrollTop +
        (rowRect.top - containerRect.top) -
        containerRect.height / 2 +
        rowRect.height / 2

      scrollContainer.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth',
      })
    }
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

  // 优先在当前可见编辑器中寻找表格
  const tableBlock = isBlockVisibleInActiveEditor(tableBlockId)
    || document.querySelector<HTMLElement>(`[data-node-id="${tableBlockId}"]`)

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

  // 立即触发平滑居中滚动
  scrollToCenterTableRow(targetRow)

  // 施加高亮闪烁动画（先清除该表格内旧高亮）
  const HIGHLIGHT_CLASS = 'sfsr-table-row-target-highlight'
  tableBlock.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(el => {
    el.classList.remove(HIGHLIGHT_CLASS)
  })

  targetRow.classList.remove(HIGHLIGHT_CLASS)
  void targetRow.offsetWidth
  targetRow.classList.add(HIGHLIGHT_CLASS)

  setTimeout(() => {
    targetRow.classList.remove(HIGHLIGHT_CLASS)
  }, 2200)

  // 针对跨文档初次加载时的时序抗干扰校验：
  // 300ms 后再次校验 targetRow 是否偏离视口中心较多；若被思源微任务拉偏，再次执行居中滚动纠偏
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
  }, 300)
}

/**
 * 跨文档跳转并聚焦命中块
 */
export async function navigateToGlobalMatch(match: GlobalMatchSnippet) {
  globalSearchState.selectedMatchId = match.matchId
  const plugin = getPluginInstance()

  try {
    if (plugin?.app) {
      // 1. 若为表格命中，检查目标表格是否已存在于当前活动编辑器中
      if (match.blockType === 't' && (typeof match.tableRowIndex === 'number' || match.tableRowText)) {
        const visibleTable = isBlockVisibleInActiveEditor(match.blockId)
        if (visibleTable) {
          // 目标表格已在当前活动页面可见！直接在当前视图执行行定位，绝对不调用 openTab 重复聚焦整个表格块
          scrollAndHighlightTableRow(
            match.blockId,
            match.tableRowIndex,
            match.tableRowText,
            match.matchedText,
            match.matchedCellText,
          )
          return
        }
      }

      // 2. 目标块未在当前活动编辑器中（跨文档或未打开）：调用 openTab 打开文档
      // 表格块不传入 cb-get-focus，避免思源内核把光标死锁在表格第 1 单元格并强制回滚到表格头部
      const action: TProtyleAction[] = match.blockType === 't'
        ? ['cb-get-hl']
        : ['cb-get-hl', 'cb-get-focus']

      await openTab({
        app: plugin.app,
        doc: {
          id: match.blockId,
          action,
        },
      })

      // 3. 打开后定位表格行（初次打开 Tab 需等待 Protyle 渲染就绪）
      if (match.blockType === 't' && (typeof match.tableRowIndex === 'number' || match.tableRowText)) {
        setTimeout(() => {
          scrollAndHighlightTableRow(
            match.blockId,
            match.tableRowIndex,
            match.tableRowText,
            match.matchedText,
            match.matchedCellText,
          )
        }, 150)
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
