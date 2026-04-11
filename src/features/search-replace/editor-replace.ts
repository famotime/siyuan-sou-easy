import { preserveReplacementCase } from './preserve-case'
import {
  CURRENT_MATCH_CLASS,
  MATCH_CLASS,
} from './editor-constants'
import { getOwnedTextNodes } from './editor-blocks'
import type {
  ReplacementOutcome,
  SearchMatch,
} from './types'

interface TextRangeLocation {
  node: Text
  startOffset: number
  endOffset: number
}

export function applyReplacementsToClone(
  blockElement: HTMLElement,
  replacements: Array<Pick<SearchMatch, 'start' | 'end' | 'matchedText'>>,
  replacementText: string,
  options?: { preserveCase?: boolean },
): ReplacementOutcome {
  const clone = blockElement.cloneNode(true) as HTMLElement
  clone.classList.remove(MATCH_CLASS)
  clone.classList.remove(CURRENT_MATCH_CLASS)

  const sortedReplacements = [...replacements].sort((left, right) => right.start - left.start)
  let appliedCount = 0

  sortedReplacements.forEach((replacement) => {
    const location = locateRangeInSingleTextNode(clone, replacement.start, replacement.end)
    if (!location) {
      return
    }

    const text = location.node.nodeValue ?? ''
    const currentText = text.slice(location.startOffset, location.endOffset)
    if (currentText !== replacement.matchedText) {
      return
    }

    const nextReplacementText = options?.preserveCase
      ? preserveReplacementCase(replacementText, replacement.matchedText)
      : replacementText

    location.node.nodeValue = [
      text.slice(0, location.startOffset),
      nextReplacementText,
      text.slice(location.endOffset),
    ].join('')

    appliedCount += 1
  })

  if (appliedCount === 0) {
    return {
      clone: null,
      appliedCount,
    }
  }

  return {
    clone,
    appliedCount,
  }
}

export function isRangeReplaceable(blockElement: HTMLElement, start: number, end: number) {
  return Boolean(locateRangeInSingleTextNode(blockElement, start, end))
}

function locateRangeInSingleTextNode(blockElement: HTMLElement, start: number, end: number): TextRangeLocation | null {
  const textNodes = getOwnedTextNodes(blockElement)
  let cursor = 0

  for (const textNode of textNodes) {
    const text = textNode.nodeValue ?? ''
    const nextCursor = cursor + text.length
    const insideCurrentNode = start >= cursor && end <= nextCursor
    if (insideCurrentNode) {
      return {
        node: textNode,
        startOffset: start - cursor,
        endOffset: end - cursor,
      }
    }

    cursor = nextCursor
  }

  return null
}
