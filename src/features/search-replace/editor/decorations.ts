import {
  ATTRIBUTE_VIEW_CELL_CURRENT_CLASS,
  ATTRIBUTE_VIEW_CELL_MATCH_CLASS,
  CURRENT_MATCH_CLASS,
  CURRENT_TEXT_HIGHLIGHT_NAME,
  MATCH_CLASS,
  MATCH_TEXT_HIGHLIGHT_NAME,
  TABLE_NODE_TYPE,
} from './constants'
import { findAttributeViewCellElements } from './attribute-view'
import { getBlockElement } from './blocks'
import { locateTextRange } from './ranges'
import {
  resolveEditorScrollContainer,
  resolveVisibilityContainers,
  scrollContainerTo,
} from './scroll-container'
import {
  getTableRowCells,
  getTableRowElements,
  resolveTableRowElementFromCell,
} from './table-dom'
import { debugElement, debugLog, debugRect } from '../debug'
import type {
  EditorContext,
  SearchMatch,
  ScrollMatchResult,
} from '../types'

interface ScrollTarget {
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

export function buildPreview(text: string, start: number, end: number, windowSize = 18) {
  const rawBefore = text.slice(Math.max(0, start - windowSize), start)
  const rawAfter = text.slice(end, Math.min(text.length, end + windowSize))
  const before = rawBefore.replace(/\s+/g, ' ')
  const match = text.slice(start, end).replace(/\s+/g, ' ')
  const after = rawAfter.replace(/\s+/g, ' ')
  const prefix = start > windowSize ? '…' : ''
  const suffix = end + windowSize < text.length ? '…' : ''
  return `${prefix}${before}[${match}]${after}${suffix}`
}

export function syncSearchDecorations(context: EditorContext, matches: SearchMatch[], currentMatch: SearchMatch | null) {
  clearSearchDecorations(context)

  const textHighlightedMatchIds = applyMatchTextHighlights(context, matches)
  const tableCellHighlightedMatchIds = applyTableCellHighlights(context, matches, currentMatch, textHighlightedMatchIds)
  applyAttributeViewCellHighlights(context, matches, currentMatch)
  const matchedBlockIds = new Set(
    matches
      .filter(match => {
        if (match.sourceKind === 'attribute-view') {
          return true
        }

        return !textHighlightedMatchIds.has(match.id) && !tableCellHighlightedMatchIds.has(match.id)
      })
      .map(match => match.blockId),
  )

  matchedBlockIds.forEach((blockId) => {
    getBlockElement(context, blockId)?.classList.add(MATCH_CLASS)
  })

  if (currentMatch) {
    applyCurrentTextHighlight(context, currentMatch)
    const usesTableTextHighlight = currentMatch.blockType === TABLE_NODE_TYPE && textHighlightedMatchIds.has(currentMatch.id)
    if (!usesTableTextHighlight && !tableCellHighlightedMatchIds.has(currentMatch.id)) {
      getBlockElement(context, currentMatch.blockId)?.classList.add(CURRENT_MATCH_CLASS)
    }
  }
}

export function clearSearchDecorations(context?: EditorContext | null) {
  clearTextHighlights()

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

export function scrollMatchIntoView(
  context: EditorContext,
  match: SearchMatch | null,
  mode: 'always' | 'if-needed' = 'always',
): ScrollMatchResult {
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
    debugLog('match-scroll:visible', {
      matchId: match.id,
      mode,
      target: debugElement(element),
      verticalTarget: debugElement(verticalElement),
    })
    return 'visible'
  }

  debugLog('match-scroll:start', {
    inlineRect: debugRect(inlineTarget.getRect()),
    matchId: match.id,
    mode,
    target: debugElement(element),
    verticalRect: debugRect(verticalTarget.getRect()),
    verticalTarget: debugElement(verticalElement),
    visibilityContainers: visibilityContainers.map(container => debugElement(container)),
  })

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
    centerElementWithinContainers(verticalElement, visibilityContainers, 'y')
    centerElementWithinContainers(element, visibilityContainers, 'x')
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

  debugLog('match-scroll:done', {
    inlineRect: debugRect(inlineTarget.getRect()),
    matchId: match.id,
    target: debugElement(element),
    verticalRect: debugRect(verticalTarget.getRect()),
    verticalTarget: debugElement(verticalElement),
  })

  return 'scrolled'
}

export function isMatchVisible(context: EditorContext, match: SearchMatch | null) {
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
    debugLog('match-visible:false', {
      inlineRect: debugRect(resolvedState.inlineTarget.getRect()),
      matchId: match.id,
      target: debugElement(resolvedState.element),
      verticalRect: debugRect(resolvedState.verticalTarget.getRect()),
      verticalTarget: debugElement(resolvedState.verticalElement),
      visibilityContainers: resolvedState.visibilityContainers.map(container => debugElement(container)),
    })
  }

  return visible
}

function isScrollTargetVisibleWithinContainers(target: ScrollTarget, containers: HTMLElement[]) {
  const elementRect = target.getRect()
  if (!elementRect) {
    return false
  }

  if (containers.some(container => !isRectVisibleWithinBoundary(elementRect, container.getBoundingClientRect()))) {
    return false
  }

  return isRectVisibleWithinBoundary(elementRect, {
    bottom: window.innerHeight,
    height: window.innerHeight,
    left: 0,
    right: window.innerWidth,
    top: 0,
    width: window.innerWidth,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })
}

function isRectVisibleWithinBoundary(elementRect: DOMRect | DOMRectReadOnly, boundaryRect: DOMRect | DOMRectReadOnly) {
  return (
    elementRect.top >= boundaryRect.top
    && elementRect.bottom <= boundaryRect.bottom
    && elementRect.left >= boundaryRect.left
    && elementRect.right <= boundaryRect.right
  )
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
    debugLog('match-scroll-state:unrenderable', {
      blockId: match.blockId,
      matchId: match.id,
      resolvedElement: debugElement(element),
      rootId: context.rootId,
    })
    return null
  }

  const verticalElement = resolveMatchVerticalTargetElement(context, match, element)
  const verticalVisibilityElement = isRenderableScrollElement(verticalElement)
    ? verticalElement
    : element

  const inlineTarget = verticalElement !== element
    ? createElementScrollTarget(element)
    : resolvePreciseMatchScrollTarget(context, match, element)
  const verticalTarget = verticalElement !== element
    ? createElementScrollTarget(verticalVisibilityElement)
    : inlineTarget

  return {
    element,
    inlineTarget,
    verticalElement,
    verticalTarget,
    visibilityContainers: resolveVisibilityContainers(context, element),
  }
}

function isResolvedMatchScrollStateVisible(state: ResolvedMatchScrollState) {
  return isScrollTargetVisibleWithinContainers(state.inlineTarget, state.visibilityContainers)
    && isScrollTargetVisibleWithinContainers(state.verticalTarget, state.visibilityContainers)
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
  const firstVisibleRect = clientRects.find(rect => hasUsableRect(rect))
  if (firstVisibleRect) {
    return firstVisibleRect
  }

  const boundingRect = typeof range.getBoundingClientRect === 'function'
    ? range.getBoundingClientRect()
    : null
  return hasUsableRect(boundingRect) ? boundingRect : null
}

function hasUsableRect(rect: DOMRect | DOMRectReadOnly | null | undefined) {
  if (!rect) {
    return false
  }

  return Number.isFinite(rect.top)
    && Number.isFinite(rect.bottom)
    && Number.isFinite(rect.left)
    && Number.isFinite(rect.right)
    && (rect.width > 0 || rect.height > 0)
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

function centerElementWithinContainers(
  element: HTMLElement,
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

      const elementRect = element.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const elementCenter = axis === 'y'
        ? (elementRect.top + elementRect.bottom) / 2
        : (elementRect.left + elementRect.right) / 2
      const containerCenter = axis === 'y'
        ? (containerRect.top + containerRect.bottom) / 2
        : (containerRect.left + containerRect.right) / 2
      const delta = elementCenter - containerCenter

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
      const targetCenter = axis === 'y'
        ? (targetRect.top + targetRect.bottom) / 2
        : (targetRect.left + targetRect.right) / 2
      const containerCenter = axis === 'y'
        ? (containerRect.top + containerRect.bottom) / 2
        : (containerRect.left + containerRect.right) / 2
      const delta = targetCenter - containerCenter

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

function isContainerScrollableOnAxis(container: HTMLElement, axis: 'x' | 'y') {
  if (axis === 'y') {
    return (container.scrollHeight || 0) > (container.clientHeight || 0)
  }

  return (container.scrollWidth || 0) > (container.clientWidth || 0)
}

function clampScrollOffset(offset: number, container: HTMLElement, axis: 'x' | 'y') {
  const maxScrollOffset = axis === 'y'
    ? Math.max(0, (container.scrollHeight || 0) - (container.clientHeight || 0))
    : Math.max(0, (container.scrollWidth || 0) - (container.clientWidth || 0))

  return Math.max(0, Math.min(maxScrollOffset, offset))
}

function applyTableCellHighlights(
  context: EditorContext,
  matches: SearchMatch[],
  currentMatch: SearchMatch | null,
  textHighlightedMatchIds: Set<string>,
) {
  const highlightedMatchIds = new Set<string>()

  matches.forEach((match) => {
    if (match.sourceKind === 'attribute-view' || match.blockType !== TABLE_NODE_TYPE) {
      return
    }

    if (textHighlightedMatchIds.has(match.id)) {
      return
    }

    const cell = findTableCellElement(context, match)
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

function applyCurrentTextHighlight(context: EditorContext, match: SearchMatch) {
  const range = locateTextRange(context, match)
  if (!range) {
    return false
  }

  const registry = getHighlightRegistry()
  const HighlightConstructor = getHighlightConstructor()
  if (!registry || !HighlightConstructor) {
    return false
  }

  registry.set(CURRENT_TEXT_HIGHLIGHT_NAME, new HighlightConstructor(range))
  return true
}

function clearTextHighlights() {
  getHighlightRegistry()?.delete(MATCH_TEXT_HIGHLIGHT_NAME)
  getHighlightRegistry()?.delete(CURRENT_TEXT_HIGHLIGHT_NAME)
}

function getHighlightRegistry() {
  const cssWithHighlights = globalThis.CSS as typeof CSS & {
    highlights?: {
      set: (name: string, highlight: unknown) => void
      delete: (name: string) => void
    }
  }

  return cssWithHighlights?.highlights
}

function getHighlightConstructor() {
  const HighlightConstructor = (globalThis as {
    Highlight?: new (...ranges: Range[]) => unknown
  }).Highlight

  return typeof HighlightConstructor === 'function' ? HighlightConstructor : null
}

function applyMatchTextHighlights(context: EditorContext, matches: SearchMatch[]) {
  const registry = getHighlightRegistry()
  const HighlightConstructor = getHighlightConstructor()
  if (!registry || !HighlightConstructor || !matches.length) {
    return new Set<string>()
  }

  const highlightedMatchIds = new Set<string>()
  const ranges: Range[] = []

  matches.forEach((match) => {
    const range = locateTextRange(context, match)
    if (!range) {
      return
    }

    ranges.push(range)
    highlightedMatchIds.add(match.id)
  })

  if (ranges.length > 0) {
    registry.set(MATCH_TEXT_HIGHLIGHT_NAME, new HighlightConstructor(...ranges))
  }

  return highlightedMatchIds
}

function applyAttributeViewCellHighlights(
  context: EditorContext,
  matches: SearchMatch[],
  currentMatch: SearchMatch | null,
) {
  matches.forEach((match) => {
    const cells = findAttributeViewCellElements(context, match)
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

function findTableCellElement(context: EditorContext, match: SearchMatch) {
  if (match.blockType !== TABLE_NODE_TYPE) {
    return null
  }

  const directCell = findTableCellElementByMetadata(context, match)
  if (directCell) {
    return directCell
  }

  const range = locateTextRange(context, match)
  if (!range) {
    return null
  }

  const startCell = resolveNodeElement(range.startContainer)?.closest<HTMLElement>('[data-type="NodeTableCell"], .table__cell')
  const endCell = resolveNodeElement(range.endContainer)?.closest<HTMLElement>('[data-type="NodeTableCell"], .table__cell, td, th')
  const normalizedStartCell = startCell?.matches('td, th')
    ? startCell
    : resolveNodeElement(range.startContainer)?.closest<HTMLElement>('[data-type="NodeTableCell"], .table__cell, td, th')
  if (normalizedStartCell && (!endCell || normalizedStartCell === endCell)) {
    return normalizedStartCell
  }

  return endCell
}

function findTableRowElement(context: EditorContext, match: SearchMatch) {
  const directCell = findTableCellElementByMetadata(context, match)
  if (directCell) {
    const tableBlock = getBlockElement(context, match.blockId)
    return (tableBlock && resolveTableRowElementFromCell(directCell, tableBlock))
      ?? directCell.closest<HTMLElement>('.table__row')
      ?? directCell
  }

  const fallbackCell = findTableCellElement(context, match)
  if (!fallbackCell) {
    return null
  }

  const tableBlock = getBlockElement(context, match.blockId)
  return (tableBlock && resolveTableRowElementFromCell(fallbackCell, tableBlock))
    ?? fallbackCell.closest<HTMLElement>('.table__row')
    ?? fallbackCell
}

function findTableCellElementByMetadata(context: EditorContext, match: SearchMatch) {
  const tableBlock = getBlockElement(context, match.blockId)
  if (!tableBlock) {
    return null
  }

  const cellId = match.table?.cellId?.trim()
  if (cellId) {
    const exactCell = tableBlock.querySelector<HTMLElement>(`[data-node-id="${cellId}"][data-type="NodeTableCell"]`)
      ?? tableBlock.querySelector<HTMLElement>(`[data-node-id="${cellId}"].table__cell`)
    if (exactCell) {
      return exactCell
    }
  }

  const rowIndex = match.table?.rowIndex
  const columnIndex = match.table?.columnIndex
  if (typeof rowIndex !== 'number' || typeof columnIndex !== 'number') {
    return null
  }

  const rows = getTableRowElements(tableBlock)
  const targetRow = rows[rowIndex]
  if (!targetRow) {
    return null
  }

  const rowCells = Array.from(targetRow.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement)
    .filter(child => child.matches('[data-type="NodeTableCell"], .table__cell, td, th'))

  return rowCells[columnIndex] ?? null
}

function resolveNodeElement(node: Node | null) {
  if (!node) {
    return null
  }

  return node instanceof Element ? node : node.parentElement
}
