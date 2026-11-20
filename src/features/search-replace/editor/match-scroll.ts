import type {
  EditorContext,
  ScrollMatchResult,
  SearchMatch,
} from '../types'
import type { EditorBlockRoots } from './blocks'
import {
  isCanvasMatchVisible,
  scrollCanvasMatchIntoView,
} from '../canvas/decorations'
import {
  debugElement,
  debugLog,
  debugLogLazy,
  debugRect,
} from '../debug'
import { findAttributeViewCellElements } from './attribute-view'
import {
  createViewportRect,
  hasUsableRect,
} from './block-selection'
import { getBlockElement } from './blocks'
import { TABLE_NODE_TYPE } from './constants'
import { locateTextRange } from './ranges'
import {
  resolveVisibilityContainers,
  scrollContainerTo,
} from './scroll-container'
import {
  clampScrollOffset,
  isRectVisibleWithinBoundary,
  resolveRectCenterDelta,
} from './scroll-geometry'
import {
  findTableCellElementByMetadata,
  resolveTableRowElementFromCell,
} from './table-dom'

// 拆分自 editor/decorations.ts（RF-105）：匹配滚动定位与可视性判定。
// 原实现与注释保持不变。

export interface ScrollTarget {
  getRect: () => DOMRect | DOMRectReadOnly | null
  precise: boolean
}

interface ResolvedMatchScrollState {
  element: HTMLElement
  inlineTarget: ScrollTarget
  verticalElement: HTMLElement
  verticalTarget: ScrollTarget
  visibilityContainers: HTMLElement[]
}

export function scrollMatchIntoView(
  context: EditorContext,
  match: SearchMatch | null,
  mode: 'always' | 'if-needed' = 'always',
): ScrollMatchResult {
  if (context.sourceKind === 'canvas') {
    return scrollCanvasMatchIntoView(context, match)
  }

  if (!match) {
    return 'idle'
  }

  const resolvedState = resolveMatchScrollState(context, match)
  if (!resolvedState) {
    debugLog('match-scroll:missing', {
      matchId: match.id,
      mode,
      blockId: match.blockId,
      rootId: context.rootId,
    })
    return 'missing'
  }

  const {
    element,
    inlineTarget,
    verticalElement,
    verticalTarget,
    visibilityContainers,
  } = resolvedState
  if (
    mode === 'if-needed'
    && isResolvedMatchScrollStateVisible(resolvedState)
  ) {
    debugLogLazy('match-scroll:visible', () => ({
      matchId: match.id,
      mode,
      target: debugElement(element),
      verticalTarget: debugElement(verticalElement),
    }))
    return 'visible'
  }

  debugLogLazy('match-scroll:start', () => ({
    inlineRect: debugRect(inlineTarget.getRect()),
    matchId: match.id,
    mode,
    target: debugElement(element),
    verticalRect: debugRect(verticalTarget.getRect()),
    verticalTarget: debugElement(verticalElement),
    visibilityContainers: visibilityContainers.map((container) => debugElement(container)),
  }))

  if (verticalElement !== element) {
    safeScrollIntoView(verticalElement, {
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    })
    safeScrollIntoView(element, {
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
    centerScrollTargetWithinContainers(createElementScrollTarget(verticalElement), visibilityContainers, 'y')
    centerScrollTargetWithinContainers(createElementScrollTarget(element), visibilityContainers, 'x')
  } else if (inlineTarget.precise) {
    safeScrollIntoView(element, {
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    })
    centerScrollTargetWithinContainers(inlineTarget, visibilityContainers, 'y')
    centerScrollTargetWithinContainers(inlineTarget, visibilityContainers, 'x')
  } else {
    safeScrollIntoView(element, {
      behavior: 'smooth',
      block: 'center',
      inline: 'center',
    })
  }

  debugLogLazy('match-scroll:done', () => ({
    inlineRect: debugRect(inlineTarget.getRect()),
    matchId: match.id,
    target: debugElement(element),
    verticalRect: debugRect(verticalTarget.getRect()),
    verticalTarget: debugElement(verticalElement),
  }))

  return 'scrolled'
}

export function isMatchVisible(context: EditorContext, match: SearchMatch | null) {
  if (context.sourceKind === 'canvas') {
    return isCanvasMatchVisible(context, match)
  }

  if (!match) {
    return false
  }

  const resolvedState = resolveMatchScrollState(context, match)
  if (!resolvedState) {
    debugLog('match-visible:missing', {
      blockId: match.blockId,
      matchId: match.id,
      rootId: context.rootId,
    })
    return false
  }

  const visible = isResolvedMatchScrollStateVisible(resolvedState)
  if (!visible) {
    debugLogLazy('match-visible:false', () => ({
      inlineRect: debugRect(resolvedState.inlineTarget.getRect()),
      matchId: match.id,
      target: debugElement(resolvedState.element),
      verticalRect: debugRect(resolvedState.verticalTarget.getRect()),
      verticalTarget: debugElement(resolvedState.verticalElement),
      visibilityContainers: resolvedState.visibilityContainers.map((container) => debugElement(container)),
    }))
  }

  return visible
}

function isScrollTargetVisibleWithinContainers(
  target: ScrollTarget,
  containers: HTMLElement[],
  axis: 'both' | 'x' | 'y' = 'both',
) {
  const elementRect = target.getRect()
  if (!elementRect) {
    return false
  }

  if (containers.some((container) => !isRectVisibleWithinBoundary(elementRect, container.getBoundingClientRect(), axis))) {
    return false
  }

  return isRectVisibleWithinBoundary(elementRect, createViewportRect(), axis)
}

function safeScrollIntoView(
  element: HTMLElement,
  options: ScrollIntoViewOptions,
) {
  if (typeof element.scrollIntoView === 'function') {
    element.scrollIntoView(options)
  }
}

function createElementScrollTarget(element: HTMLElement): ScrollTarget {
  return {
    getRect: () => element.getBoundingClientRect(),
    precise: false,
  }
}

function resolveMatchScrollState(context: EditorContext, match: SearchMatch): ResolvedMatchScrollState | null {
  const element = resolveMatchTargetElement(context, match)
  if (!element || !isRenderableScrollElement(element)) {
    debugLogLazy('match-scroll-state:unrenderable', () => ({
      blockId: match.blockId,
      matchId: match.id,
      resolvedElement: debugElement(element),
      rootId: context.rootId,
    }))
    return null
  }

  const verticalElement = resolveMatchVerticalTargetElement(context, match, element)
  const verticalVisibilityElement = isRenderableScrollElement(verticalElement)
    ? verticalElement
    : element

  const preciseTarget = resolvePreciseMatchScrollTarget(context, match, element)
  const hasPreciseRange = preciseTarget.precise

  const inlineTarget = hasPreciseRange
    ? preciseTarget
    : (verticalElement !== element ? createElementScrollTarget(element) : preciseTarget)
  const verticalTarget = hasPreciseRange
    ? preciseTarget
    : (verticalElement !== element ? createElementScrollTarget(verticalVisibilityElement) : inlineTarget)

  return {
    element,
    inlineTarget,
    verticalElement,
    verticalTarget,
    visibilityContainers: resolveVisibilityContainers(context, element),
  }
}

function isResolvedMatchScrollStateVisible(state: ResolvedMatchScrollState) {
  const inlineVisible = isScrollTargetVisibleWithinContainers(state.inlineTarget, state.visibilityContainers, 'both')
  if (!inlineVisible) {
    return false
  }

  if (state.verticalTarget === state.inlineTarget) {
    return true
  }

  return isScrollTargetVisibleWithinContainers(state.verticalTarget, state.visibilityContainers, 'y')
}

function resolvePreciseMatchScrollTarget(
  context: EditorContext,
  match: SearchMatch,
  fallbackElement: HTMLElement,
): ScrollTarget {
  const range = locateTextRange(context, match)
  if (!range) {
    return createElementScrollTarget(fallbackElement)
  }

  const initialRect = getRangeRect(range)
  if (!initialRect) {
    return createElementScrollTarget(fallbackElement)
  }

  return {
    getRect: () => getRangeRect(range) ?? initialRect,
    precise: true,
  }
}

function getRangeRect(range: Range) {
  const clientRects = typeof range.getClientRects === 'function'
    ? Array.from(range.getClientRects())
    : []
  const firstVisibleRect = clientRects.find((rect) => hasUsableRect(rect))
  if (firstVisibleRect) {
    return firstVisibleRect
  }

  const boundingRect = typeof range.getBoundingClientRect === 'function'
    ? range.getBoundingClientRect()
    : null
  return hasUsableRect(boundingRect) ? boundingRect : null
}

function isRenderableScrollElement(element: HTMLElement | null | undefined) {
  if (!(element instanceof HTMLElement)) {
    return false
  }

  if (element.closest('.fn__none, .protyle-attr')) {
    return false
  }

  return hasUsableRect(element.getBoundingClientRect())
}

// 与 centerScrollTargetWithinContainers 原本逐行重复的实现已合并（RF-105）：
// 元素目标统一经 createElementScrollTarget 包装后走 ScrollTarget 路径。
function centerScrollTargetWithinContainers(
  target: ScrollTarget,
  containers: HTMLElement[],
  axis: 'x' | 'y',
) {
  containers
    .slice()
    .reverse()
    .forEach((container) => {
      if (!isContainerScrollableOnAxis(container, axis)) {
        return
      }

      const targetRect = target.getRect()
      if (!targetRect) {
        return
      }

      const containerRect = container.getBoundingClientRect()
      const delta = resolveRectCenterDelta(targetRect, containerRect, axis)

      if (Math.abs(delta) <= 1) {
        return
      }

      if (axis === 'y') {
        scrollContainerTo(container, {
          behavior: 'auto',
          top: clampScrollOffset((container.scrollTop || 0) + delta, container, axis),
        })
        return
      }

      scrollContainerTo(container, {
        behavior: 'auto',
        left: clampScrollOffset((container.scrollLeft || 0) + delta, container, axis),
      })
    })
}

// 注意（RF-105 记录，不统一行为）：本函数对 hidden/visible/clip 一律视为"不可滚动"，
// 与 scroll-container.ts 的 isScrollableContainer（hidden 视为可滚动）及
// store/search-pending-navigation.ts 的 isVerticallyScrollable（hidden 视为可滚动）
// 语义相反。三处分别服务于"精细滚动定位""容器解析""近似滚动"场景，
// 历史行为按场景独立验证过，合并需单独评估，本次仅记录差异。
function isContainerScrollableOnAxis(container: HTMLElement, axis: 'x' | 'y') {
  const style = globalThis.getComputedStyle?.(container)
  if (axis === 'y') {
    const overflowY = style?.overflowY || container.style.overflowY || ''
    if (overflowY === 'hidden' || overflowY === 'visible' || overflowY === 'clip') {
      return false
    }
    return (container.scrollHeight || 0) > (container.clientHeight || 0)
  }

  const overflowX = style?.overflowX || container.style.overflowX || ''
  if (overflowX === 'hidden' || overflowX === 'visible' || overflowX === 'clip') {
    return false
  }
  return (container.scrollWidth || 0) > (container.clientWidth || 0)
}

function resolveMatchTargetElement(context: EditorContext, match: SearchMatch) {
  if (match.sourceKind === 'attribute-view') {
    return findAttributeViewCellElements(context, match)[0]
      ?? getBlockElement(context, match.blockId)
  }

  return findTableCellElement(context, match)
    ?? getBlockElement(context, match.blockId)
}

function resolveMatchVerticalTargetElement(context: EditorContext, match: SearchMatch, fallbackElement: HTMLElement) {
  if (match.blockType !== TABLE_NODE_TYPE || match.sourceKind === 'attribute-view') {
    return fallbackElement
  }

  return findTableRowElement(context, match) ?? fallbackElement
}

export function findTableCellElement(context: EditorContext, match: SearchMatch, roots?: EditorBlockRoots) {
  if (match.blockType !== TABLE_NODE_TYPE) {
    return null
  }

  const tableBlock = getBlockElement(context, match.blockId, roots)
  const directCell = tableBlock ? findTableCellElementByMetadata(tableBlock, match) : null
  if (directCell) {
    return directCell
  }

  const range = locateTextRange(context, match, roots)
  if (!range) {
    return null
  }

  const startCell = resolveNodeElement(range.startContainer)?.closest<HTMLElement>('[data-type="NodeTableCell"], .table__cell, td, th')
  const endCell = resolveNodeElement(range.endContainer)?.closest<HTMLElement>('[data-type="NodeTableCell"], .table__cell, td, th')
  if (startCell && (!endCell || startCell === endCell)) {
    return startCell
  }

  return endCell
}

function findTableRowElement(context: EditorContext, match: SearchMatch, roots?: EditorBlockRoots) {
  const tableBlock = getBlockElement(context, match.blockId, roots)
  const directCell = tableBlock ? findTableCellElementByMetadata(tableBlock, match) : null
  if (directCell) {
    return (tableBlock && resolveTableRowElementFromCell(directCell, tableBlock))
      ?? directCell.closest<HTMLElement>('.table__row')
      ?? directCell
  }

  const fallbackCell = findTableCellElement(context, match, roots)
  if (!fallbackCell) {
    return null
  }

  return (tableBlock && resolveTableRowElementFromCell(fallbackCell, tableBlock))
    ?? fallbackCell.closest<HTMLElement>('.table__row')
    ?? fallbackCell
}

function resolveNodeElement(node: Node | null) {
  if (!node) {
    return null
  }

  return node instanceof Element ? node : node.parentElement
}
