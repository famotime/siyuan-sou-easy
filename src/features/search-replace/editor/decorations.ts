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
import type {
  EditorContext,
  SearchMatch,
  ScrollMatchResult,
} from '../types'

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
  const tableCellHighlightedMatchIds = applyTableCellHighlights(context, matches, currentMatch)
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
    if (!tableCellHighlightedMatchIds.has(currentMatch.id)) {
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

  const element = resolveMatchTargetElement(context, match)
  if (!element) {
    return 'missing'
  }

  const scrollContainer = resolveScrollContainer(context)
  if (mode === 'if-needed' && isElementVisibleWithinContainer(element, scrollContainer)) {
    return 'visible'
  }

  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  })

  return 'scrolled'
}

function resolveScrollContainer(context: EditorContext) {
  return context.protyle.querySelector<HTMLElement>('.protyle-content')
    ?? context.protyle.querySelector<HTMLElement>('.protyle-wysiwyg')
    ?? null
}

function isElementVisibleWithinContainer(element: HTMLElement, container: HTMLElement | null) {
  const elementRect = element.getBoundingClientRect()

  if (container) {
    const containerRect = container.getBoundingClientRect()
    return elementRect.top >= containerRect.top && elementRect.bottom <= containerRect.bottom
  }

  return elementRect.top >= 0 && elementRect.bottom <= window.innerHeight
}

function applyTableCellHighlights(
  context: EditorContext,
  matches: SearchMatch[],
  currentMatch: SearchMatch | null,
) {
  const highlightedMatchIds = new Set<string>()

  matches.forEach((match) => {
    if (match.sourceKind === 'attribute-view' || match.blockType !== TABLE_NODE_TYPE) {
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

function findTableCellElement(context: EditorContext, match: SearchMatch) {
  if (match.blockType !== TABLE_NODE_TYPE) {
    return null
  }

  const range = locateTextRange(context, match)
  if (!range) {
    return null
  }

  const startCell = resolveNodeElement(range.startContainer)?.closest<HTMLElement>('[data-type="NodeTableCell"], .table__cell')
  const endCell = resolveNodeElement(range.endContainer)?.closest<HTMLElement>('[data-type="NodeTableCell"], .table__cell')
  if (startCell && (!endCell || startCell === endCell)) {
    return startCell
  }

  return endCell
}

function resolveNodeElement(node: Node | null) {
  if (!node) {
    return null
  }

  return node instanceof Element ? node : node.parentElement
}
