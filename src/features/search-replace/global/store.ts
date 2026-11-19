import { reactive } from 'vue'
import { openTab, type TProtyleAction } from 'siyuan'
import { getPluginInstance } from '@/plugin-instance'
import { checkBlockFold, unfoldBlock } from '@/features/search-replace/kernel'
import { createRevisionGuard } from '@/features/search-replace/store/revision'
import type {
  GlobalMatchSnippet,
  GlobalSearchSortMode,
  GlobalSearchStateModel,
} from './types'
import { parseDateFilterValue, parseGlobalQuery } from './query-parser'
import { executeGlobalBlockQuery } from './kernel-query'
import {
  aggregateBlocksToDocs,
  sortDocAggregateNodes,
} from './doc-aggregator'

export const globalSearchState = reactive<GlobalSearchStateModel>({
  query: '',
  searchedQuery: '',
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

const globalSearchRevision = createRevisionGuard()
// spinner 语义是"存在进行中的搜索"，用 in-flight 计数驱动；结果写入用 revision 守卫。
// 两者分离：过期搜索结束时不会误关新搜索的 spinner，也不会让已死搜索的 spinner 卡住。
let inFlightSearchCount = 0

// 跳转高亮的定时器链（重试/清理/复检/补偿）集中登记，Dock 销毁或插件卸载时统一清除
const activeHighlightTimers = new Set<ReturnType<typeof setTimeout>>()

function registerHighlightTimer(callback: () => void, delay: number) {
  const timer = setTimeout(() => {
    activeHighlightTimers.delete(timer)
    callback()
  }, delay)
  activeHighlightTimers.add(timer)
  return timer
}

export function cancelGlobalHighlightTimers() {
  activeHighlightTimers.forEach(timer => clearTimeout(timer))
  activeHighlightTimers.clear()
}

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
  if (query.trim() !== globalSearchState.searchedQuery) {
    clearGlobalSearchResults()
  }
}

export function setGlobalReplacement(replacement: string) {
  globalSearchState.replacement = replacement
}

export function toggleGlobalOption(option: keyof GlobalSearchStateModel['options']) {
  globalSearchState.options[option] = !globalSearchState.options[option]
  const current = globalSearchState.query.trim()
  if (current && current === globalSearchState.searchedQuery) {
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
      registerHighlightTimer(() => {
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

  registerHighlightTimer(() => {
    targetRow.classList.remove(HIGHLIGHT_CLASS)
  }, 2200)

  // 针对跨文档初次加载时的时序抗干扰校验：
  // 300ms 后再次校验 targetRow 是否偏离视口中心较多；若被思源微任务拉偏，再次执行居中滚动纠偏
  registerHighlightTimer(() => {
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
 * 在当前活动编辑器中，平滑滚动定位并高亮目标常规块（段落/标题/列表项等）
 */
export function scrollAndHighlightBlock(blockElement: HTMLElement, shouldFocus = true) {
  // 1. 平滑滚动使目标块居中显示
  blockElement.scrollIntoView({ behavior: 'smooth', block: 'center' })

  // 2. 将光标聚焦到其可编辑区域（若需要）
  if (shouldFocus) {
    const editable = blockElement.querySelector<HTMLElement>('[contenteditable="true"]') || blockElement
    editable.focus()
  }

  // 3. 注入动态高亮闪烁样式
  const HIGHLIGHT_CLASS = 'sfsr-block-target-highlight'
  blockElement.classList.remove(HIGHLIGHT_CLASS)
  // 触发重绘以确保多次点击同一块时能重新播放动画
  void blockElement.offsetWidth
  blockElement.classList.add(HIGHLIGHT_CLASS)

  registerHighlightTimer(() => {
    blockElement.classList.remove(HIGHLIGHT_CLASS)
  }, 2200)
}

/**
 * 跨文档跳转并聚焦命中块（支持展示文档全文并高亮提示命中段落）
 */
export async function navigateToGlobalMatch(match: GlobalMatchSnippet) {
  globalSearchState.selectedMatchId = match.matchId
  const plugin = getPluginInstance()

  try {
    if (plugin?.app) {
      // 1. 若目标块位于折叠标题下方，预先自动展开折叠标题，确保定位后段落不被隐藏
      try {
        const foldStatus = await checkBlockFold(match.blockId)
        if (foldStatus?.isFolded) {
          await unfoldBlock(match.blockId)
        }
      } catch {
        // 忽略折叠检测异常，不阻断主跳转链路
      }

      // 2. 检查目标块是否已存在于当前可见的活动编辑器中（如同一文档内快速切换）
      const visibleBlock = isBlockVisibleInActiveEditor(match.blockId)
      if (visibleBlock) {
        if (match.blockType === 't' && (typeof match.tableRowIndex === 'number' || match.tableRowText)) {
          scrollAndHighlightTableRow(
            match.blockId,
            match.tableRowIndex,
            match.tableRowText,
            match.matchedText,
            match.matchedCellText,
          )
        } else {
          scrollAndHighlightBlock(visibleBlock, true)
        }
        return
      }

      // 3. 目标块未在当前活动编辑器中（跨文档或未渲染）：调用 openTab 打开文档全文
      // 核心规范：传入 cb-get-context 和 cb-get-rootscroll，指示思源内核以 Mode 3 载入整篇文档上下文与标题，
      // 严禁传入 cb-get-all（否则会导致 protyle.block.showAll=true 退化为单块 ZoomIn 缩放模式）。
      // 表格块不传入 cb-get-focus，避免光标锁死首个单元格导致表格被强制拉回头部。
      const action: TProtyleAction[] = match.blockType === 't'
        ? ['cb-get-hl', 'cb-get-context', 'cb-get-rootscroll']
        : ['cb-get-hl', 'cb-get-focus', 'cb-get-context', 'cb-get-rootscroll']

      await openTab({
        app: plugin.app,
        doc: {
          id: match.blockId,
          action,
        },
      })

      // 4. 打开后初次等待 Protyle 挂载就绪，补充强化高亮提示动画
      registerHighlightTimer(() => {
        if (match.blockType === 't' && (typeof match.tableRowIndex === 'number' || match.tableRowText)) {
          scrollAndHighlightTableRow(
            match.blockId,
            match.tableRowIndex,
            match.tableRowText,
            match.matchedText,
            match.matchedCellText,
          )
        } else {
          const renderedBlock = isBlockVisibleInActiveEditor(match.blockId)
          if (renderedBlock) {
            scrollAndHighlightBlock(renderedBlock, false)
          }
        }
      }, 180)
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
