import type {
  EditorContext,
  SearchDecorationOptions,
  SearchMatch,
} from '../types'
import type { EditorBlockRoots } from './blocks'
import {
  clearCanvasSearchDecorations,
  syncCanvasSearchDecorations,
} from '../canvas/decorations'
import { findAttributeViewCellElements } from './attribute-view'
import {
  getBlockElement,
  resolveEditorBlockRoots,
} from './blocks'
import {
  ATTRIBUTE_VIEW_CELL_CURRENT_CLASS,
  ATTRIBUTE_VIEW_CELL_MATCH_CLASS,
  CURRENT_MATCH_CLASS,
  MATCH_CLASS,
  TABLE_NODE_TYPE,
} from './constants'
import { findTableCellElement } from './match-scroll'
import {
  applyCurrentTextHighlight,
  applyMatchTextHighlights,
  clearTextHighlightsIfOwned,
} from './text-highlight'

// 编辑器搜索装饰层（RF-105 拆分后）：
// - 本文件：块级 / 表格单元格 / 属性视图单元格 class 装饰的同步与清除
// - match-scroll.ts：匹配滚动定位与可视性判定
// - text-highlight.ts：CSS Custom Highlight 注册表与文本高亮缓存

export function syncSearchDecorations(
  context: EditorContext,
  matches: SearchMatch[],
  currentMatch: SearchMatch | null,
  options: SearchDecorationOptions = {},
) {
  if (context.sourceKind === 'canvas') {
    syncCanvasSearchDecorations({
      context,
      currentMatch,
      matches,
    })
    return
  }

  clearSearchDecorations(context)

  // 一次装饰同步周期内 DOM 状态不变：滚动容器与搜索根只解析一次，循环体内复用
  const roots = resolveEditorBlockRoots(context)

  const textHighlightState = applyMatchTextHighlights(context, matches, options, roots)
  const textHighlightedMatchIds = textHighlightState.highlightedMatchIds
  const tableCellHighlightedMatchIds = applyTableCellHighlights(context, matches, currentMatch, textHighlightedMatchIds, roots)
  applyAttributeViewCellHighlights(context, matches, currentMatch, roots)
  const matchedBlockIds = new Set(
    matches
      .filter((match) => {
        if (match.sourceKind === 'attribute-view') {
          return true
        }

        return !textHighlightedMatchIds.has(match.id) && !tableCellHighlightedMatchIds.has(match.id)
      })
      .map((match) => match.blockId),
  )

  matchedBlockIds.forEach((blockId) => {
    getBlockElement(context, blockId, roots)?.classList.add(MATCH_CLASS)
  })

  if (currentMatch) {
    const currentTextHighlightApplied = applyCurrentTextHighlight(context, currentMatch, textHighlightState.rangesByMatchId, roots)
    // 表格匹配以文本强调作为"当前"标识（不再叠加块级/单元格 class）；
    // 当文本强调注册意外失败时回退为块级标识，避免"当前"提示完全丢失。
    const usesTableTextHighlight = currentMatch.blockType === TABLE_NODE_TYPE
      && textHighlightedMatchIds.has(currentMatch.id)
      && currentTextHighlightApplied
    if (!usesTableTextHighlight && !tableCellHighlightedMatchIds.has(currentMatch.id)) {
      getBlockElement(context, currentMatch.blockId, roots)?.classList.add(CURRENT_MATCH_CLASS)
    }
  }
}

export function clearSearchDecorations(context?: EditorContext | null) {
  if (context?.sourceKind === 'canvas') {
    clearCanvasSearchDecorations(context)
    return
  }

  clearTextHighlightsIfOwned(context)

  const root = context?.protyle ?? document
  root.querySelectorAll(`.${ATTRIBUTE_VIEW_CELL_MATCH_CLASS}`).forEach((element) => {
    element.classList.remove(ATTRIBUTE_VIEW_CELL_MATCH_CLASS)
  })
  root.querySelectorAll(`.${ATTRIBUTE_VIEW_CELL_CURRENT_CLASS}`).forEach((element) => {
    element.classList.remove(ATTRIBUTE_VIEW_CELL_CURRENT_CLASS)
  })
  root.querySelectorAll(`.${MATCH_CLASS}`).forEach((element) => {
    element.classList.remove(MATCH_CLASS)
  })
  root.querySelectorAll(`.${CURRENT_MATCH_CLASS}`).forEach((element) => {
    element.classList.remove(CURRENT_MATCH_CLASS)
  })
}

function applyTableCellHighlights(
  context: EditorContext,
  matches: SearchMatch[],
  currentMatch: SearchMatch | null,
  textHighlightedMatchIds: Set<string>,
  roots?: EditorBlockRoots,
) {
  const highlightedMatchIds = new Set<string>()

  matches.forEach((match) => {
    if (match.sourceKind === 'attribute-view' || match.blockType !== TABLE_NODE_TYPE) {
      return
    }

    if (textHighlightedMatchIds.has(match.id)) {
      return
    }

    const cell = findTableCellElement(context, match, roots)
    if (!cell) {
      return
    }

    cell.classList.add(ATTRIBUTE_VIEW_CELL_MATCH_CLASS)
    if (currentMatch?.id === match.id) {
      cell.classList.add(ATTRIBUTE_VIEW_CELL_CURRENT_CLASS)
    }
    highlightedMatchIds.add(match.id)
  })

  return highlightedMatchIds
}

function applyAttributeViewCellHighlights(
  context: EditorContext,
  matches: SearchMatch[],
  currentMatch: SearchMatch | null,
  roots?: EditorBlockRoots,
) {
  matches.forEach((match) => {
    const cells = findAttributeViewCellElements(context, match, roots)
    if (!cells.length) {
      return
    }

    cells.forEach((cell) => {
      cell.classList.add(ATTRIBUTE_VIEW_CELL_MATCH_CLASS)
      if (currentMatch?.id === match.id) {
        cell.classList.add(ATTRIBUTE_VIEW_CELL_CURRENT_CLASS)
      }
    })
  })
}
