import {
  CURRENT_MATCH_CLASS,
  MATCH_CLASS,
} from './constants'
import { locateRangeInSingleTextNode } from './ranges'
import { preserveReplacementCase } from '../preserve-case'
import type {
  ReplacementOutcome,
  SearchMatch,
} from '../types'

export function applyReplacementsToClone(
  blockElement: HTMLElement,
  replacements: Array<Pick<SearchMatch, 'start' | 'occ' | 'matchedText'>>,
  replacementText: string,
  options?: { preserveCase?: boolean },
): ReplacementOutcome {
  const clone = blockElement.cloneNode(true) as HTMLElement
  clone.classList.remove(MATCH_CLASS)
  clone.classList.remove(CURRENT_MATCH_CLASS)

  const sortedReplacements = [...replacements].sort((left, right) => right.occ - left.occ)
  let appliedCount = 0

  sortedReplacements.forEach((replacement) => {
    const location = locateRangeInSingleTextNode(clone, replacement.matchedText, replacement.occ)
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

export function isRangeReplaceable(blockElement: HTMLElement, matchedText: string, occ: number) {
  return Boolean(locateRangeInSingleTextNode(blockElement, matchedText, occ))
}
