import {
  CURRENT_MATCH_CLASS,
  CURRENT_TEXT_HIGHLIGHT_NAME,
  MATCH_CLASS,
  MATCH_TEXT_HIGHLIGHT_NAME,
} from './editor-constants'
import {
  getBlockElement,
  getOwnedTextNodes,
} from './editor-blocks'
import type {
  EditorContext,
  SearchMatch,
} from './types'

interface TextPoint {
  node: Text
  offset: number
}

export function syncSearchDecorations(context: EditorContext, matches: SearchMatch[], currentMatch: SearchMatch | null) {
  clearSearchDecorations(context)

  const textHighlightedMatchIds = applyMatchTextHighlights(context, matches)
  const matchedBlockIds = new Set(
    matches
      .filter(match => !textHighlightedMatchIds.has(match.id))
      .map(match => match.blockId),
  )

  matchedBlockIds.forEach((blockId) => {
    getBlockElement(context, blockId)?.classList.add(MATCH_CLASS)
  })

  if (currentMatch) {
    applyCurrentTextHighlight(context, currentMatch)
    getBlockElement(context, currentMatch.blockId)?.classList.add(CURRENT_MATCH_CLASS)
  }
}

export function clearSearchDecorations(context?: EditorContext | null) {
  clearTextHighlights()

  const root = context?.protyle ?? document
  root.querySelectorAll(`.${MATCH_CLASS}`).forEach((element) => {
    element.classList.remove(MATCH_CLASS)
  })
  root.querySelectorAll(`.${CURRENT_MATCH_CLASS}`).forEach((element) => {
    element.classList.remove(CURRENT_MATCH_CLASS)
  })
}

export function scrollMatchIntoView(context: EditorContext, match: SearchMatch | null) {
  if (!match) {
    return
  }

  const element = getBlockElement(context, match.blockId)
  if (!element) {
    return
  }

  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  })
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

function locateTextRange(context: EditorContext, match: SearchMatch) {
  const blockElement = getBlockElement(context, match.blockId)
  if (!blockElement) {
    return null
  }

  const textNodes = getOwnedTextNodes(blockElement)
  if (!textNodes.length) {
    return null
  }

  const startPoint = locateTextPoint(textNodes, match.start)
  const endPoint = locateTextPoint(textNodes, match.end)
  if (!startPoint || !endPoint) {
    return null
  }

  const range = document.createRange()
  range.setStart(startPoint.node, startPoint.offset)
  range.setEnd(endPoint.node, endPoint.offset)
  return range
}

function locateTextPoint(textNodes: Text[], targetOffset: number): TextPoint | null {
  let cursor = 0

  for (const textNode of textNodes) {
    const text = textNode.nodeValue ?? ''
    const nextCursor = cursor + text.length
    const isInsideNode = targetOffset >= cursor && targetOffset <= nextCursor
    if (isInsideNode) {
      return {
        node: textNode,
        offset: targetOffset - cursor,
      }
    }
    cursor = nextCursor
  }

  const lastNode = textNodes[textNodes.length - 1]
  const lastLength = lastNode.nodeValue?.length ?? 0
  if (targetOffset === cursor) {
    return {
      node: lastNode,
      offset: lastLength,
    }
  }

  return null
}
