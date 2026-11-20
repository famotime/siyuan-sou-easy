import type { TProtyleAction } from 'siyuan'
import type { GlobalMatchSnippet } from '../types'
import { openTab } from 'siyuan'
import {
  checkBlockFold,
  unfoldBlock,
} from '@/features/search-replace/kernel'
import { getPluginInstance } from '@/plugin-instance'
import { globalSearchState } from './state'

// 拆分自 global/store.ts（RF-106）：全库命中的 DOM 导航与高亮。
// 状态与 UI 动作见 state.ts，搜索执行见 search-actions.ts。

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
  activeHighlightTimers.forEach((timer) => clearTimeout(timer))
  activeHighlightTimers.clear()
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
        .map((k) => k.trim())
        .filter(Boolean)
    : []

  const containsAnyKeyword = (text: string) => {
    if (!keywords.length) return true
    return keywords.some((k) => text.includes(k))
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
  const bestRow = findBestScoredTableRow(rows, {
    containsAnyKeyword,
    keywords,
    matchedCellText,
    rowIndex,
    rowText,
  })
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
 * 特征打分法选行（RF-111 自 findTargetTableRowElement 拆出）：
 * 命中单元格特征 +50、同行多列文本命中每项 +20、与预期 rowIndex 的距离偏置最高 +30。
 */
function findBestScoredTableRow(
  rows: HTMLElement[],
  context: {
    containsAnyKeyword: (text: string) => boolean
    keywords: string[]
    matchedCellText?: string
    rowIndex?: number
    rowText?: string
  },
) {
  let bestRow: HTMLElement | null = null
  let maxScore = -1

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const text = r.textContent || ''
    if (context.keywords.length && !context.containsAnyKeyword(text)) {
      continue // 必须至少包含搜索关键词之一
    }

    let score = 10
    // 如果包含命中单元格特征文本，大幅加分
    if (context.matchedCellText && text.includes(context.matchedCellText)) {
      score += 50
    }
    // 如果 rowText 中包含的同一行其他列文本也出现在该行中，按命中加分
    if (context.rowText) {
      const parts = context.rowText.split(' | ').map((p) => p.trim()).filter((p) => p.length >= 2)
      for (const part of parts) {
        if (text.includes(part)) {
          score += 20
        }
      }
    }
    // 与预期 rowIndex 距离越近，加一定的位置偏置分（防止远距离误匹配）
    if (typeof context.rowIndex === 'number') {
      const distance = Math.abs(i - context.rowIndex)
      score += Math.max(0, 30 - distance * 2)
    }

    if (score > maxScore) {
      maxScore = score
      bestRow = r
    }
  }

  return bestRow
}

/**
 * 将目标表格行平滑滚动至 Protyle 编辑器视口正中心
 */
function scrollToCenterTableRow(targetRow: HTMLElement) {
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
        currentScrollTop
        + (rowRect.top - containerRect.top)
        - containerRect.height / 2
        + rowRect.height / 2

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
  tableBlock.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => {
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
  blockElement.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  })

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
