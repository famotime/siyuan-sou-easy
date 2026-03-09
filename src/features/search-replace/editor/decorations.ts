import {
  CURRENT_MATCH_CLASS,
  CURRENT_TEXT_HIGHLIGHT_NAME,
  MATCH_CLASS,
  MATCH_TEXT_HIGHLIGHT_NAME,
} from './constants'
import { getBlockElement } from './blocks'
import { locateTextRange } from './ranges'
import type {
  EditorContext,
  SearchMatch,
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

export function scrollMatchIntoView(
  context: EditorContext,
  match: SearchMatch | null,
  mode: 'always' | 'if-needed' = 'always',
) {
  if (!match) {
    return
  }

  const element = getBlockElement(context, match.blockId)
  if (!element) {
    return
  }

  const scrollContainer = resolveScrollContainer(context)
  if (mode === 'if-needed' && isElementVisibleWithinContainer(element, scrollContainer)) {
    return
  }

  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  })
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
