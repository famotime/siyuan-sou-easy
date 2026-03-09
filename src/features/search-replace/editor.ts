import { preserveReplacementCase } from './preserve-case'
import type {
  EditorContext,
  ReplacementOutcome,
  SearchMatch,
  SearchOptions,
  SearchableBlock,
  SelectionScope,
  TextOffsetRange,
} from './types'

const MATCH_CLASS = 'sfsr-block-match'
const CURRENT_MATCH_CLASS = 'sfsr-block-current'
const MATCH_TEXT_HIGHLIGHT_NAME = 'sfsr-match'
const CURRENT_TEXT_HIGHLIGHT_NAME = 'sfsr-current-match'
const SUPPORTED_NODE_TYPES = new Set([
  'NodeParagraph',
  'NodeHeading',
  'NodeListItem',
])
const CODE_NODE_TYPE = 'NodeCodeBlock'

interface TextRangeLocation {
  node: Text
  startOffset: number
  endOffset: number
}

interface TextPoint {
  node: Text
  offset: number
}

export function getCurrentSelectionText() {
  return window.getSelection()?.toString() ?? ''
}

export function getCurrentSelectionScope(context: EditorContext): SelectionScope {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return new Map()
  }

  const scope: SelectionScope = new Map()
  const blockElements = Array.from(
    context.protyle.querySelectorAll<HTMLElement>('.protyle-wysiwyg [data-node-id][data-type]'),
  )
  const seen = new Set<string>()

  blockElements.forEach((blockElement) => {
    const blockId = blockElement.dataset.nodeId
    if (!blockId || seen.has(blockId)) {
      return
    }

    seen.add(blockId)
    const ranges = getSelectionRangesWithinBlock(blockElement, selection)
    if (!ranges.length) {
      return
    }

    scope.set(blockId, ranges)
  })

  return scope
}

export function getActiveEditorContext(): EditorContext | null {
  const selection = window.getSelection()
  const anchorElement = selection?.anchorNode instanceof Element
    ? selection.anchorNode
    : selection?.anchorNode?.parentElement

  const directCandidates = [
    createEditorContextFromElement(anchorElement?.closest('.protyle')),
    createEditorContextFromElement((document.activeElement as HTMLElement | null)?.closest?.('.protyle')),
  ].filter(Boolean) as EditorContext[]

  const visibleContexts = collectVisibleEditorContexts()
  const titleMatchedContext = findContextByCurrentPageTitle(visibleContexts)

  if (directCandidates.length > 0) {
    if (titleMatchedContext) {
      const directTitleMatch = directCandidates.find(candidate => candidate.rootId === titleMatchedContext.rootId)
      if (directTitleMatch) {
        return directTitleMatch
      }

      return titleMatchedContext
    }

    return directCandidates[0]
  }

  if (titleMatchedContext) {
    return titleMatchedContext
  }

  const activeWindowContext = createEditorContextFromElement(document.querySelector('.layout__wnd--active .protyle'))
  if (activeWindowContext) {
    return activeWindowContext
  }

  if (visibleContexts.length > 0) {
    return visibleContexts[0]
  }

  return null
}

export function createEditorContextFromElement(protyle: HTMLElement | null | undefined, rootIdHint = '', titleHint = ''): EditorContext | null {
  if (!(protyle instanceof HTMLElement)) {
    return null
  }

  const rootId = rootIdHint.trim() || getRootId(protyle)
  if (!rootId) {
    return null
  }

  return {
    protyle,
    rootId,
    title: titleHint.trim() || getEditorTitle(protyle),
  }
}

export function createEditorContextFromProtyleLike(protyle: {
  block?: {
    rootID?: string
  }
  element?: HTMLElement
} | null | undefined) {
  return createEditorContextFromElement(protyle?.element, protyle?.block?.rootID)
}

export function findEditorContextByRootId(rootId: string, titleHint = '') {
  const normalizedRootId = rootId.trim()
  if (!normalizedRootId) {
    return null
  }

  const visibleContexts = collectVisibleEditorContexts()
  const exactMatch = visibleContexts.find(context => context.rootId === normalizedRootId)
  if (exactMatch) {
    return exactMatch
  }

  if (titleHint.trim()) {
    return visibleContexts.find(context => context.title === titleHint.trim()) ?? null
  }

  return null
}

export function collectSearchableBlocks(context: EditorContext, options: SearchOptions): SearchableBlock[] {
  const blockElements = Array.from(
    context.protyle.querySelectorAll<HTMLElement>('.protyle-wysiwyg [data-node-id][data-type]'),
  )
  const blocks: SearchableBlock[] = []
  const seen = new Set<string>()

  blockElements.forEach((element, blockIndex) => {
    const blockId = element.dataset.nodeId
    const blockType = element.dataset.type
    if (!blockId || !blockType || seen.has(blockId) || !isSupportedBlockType(blockType, options)) {
      return
    }

    const text = getBlockPlainText(element)
    if (!text) {
      return
    }

    seen.add(blockId)
    blocks.push({
      blockId,
      rootId: context.rootId,
      blockType,
      blockIndex,
      text,
      element,
    })
  })

  return blocks
}

export function getBlockElement(context: EditorContext, blockId: string) {
  return context.protyle.querySelector<HTMLElement>(`.protyle-wysiwyg [data-node-id="${blockId}"][data-type]`)
    ?? context.protyle.querySelector<HTMLElement>(`[data-node-id="${blockId}"][data-type]`)
    ?? context.protyle.querySelector<HTMLElement>(`[data-node-id="${blockId}"]`)
}

export function getBlockPlainText(blockElement: HTMLElement) {
  const textNodes = getOwnedTextNodes(blockElement)
  return textNodes.map(node => node.nodeValue ?? '').join('')
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

function getRootId(protyle: HTMLElement) {
  const background = protyle.querySelector<HTMLElement>('.protyle-background[data-node-id]')
  if (background?.dataset.nodeId) {
    return background.dataset.nodeId
  }

  const titleElement = protyle.querySelector<HTMLElement>('.protyle-title[data-node-id]')
  return titleElement?.dataset.nodeId ?? ''
}

function getEditorTitle(protyle: HTMLElement) {
  const titleInput = protyle.querySelector<HTMLInputElement | HTMLTextAreaElement>('.protyle-title__input')
  if (titleInput?.value) {
    return titleInput.value
  }

  return '当前文档'
}

function collectVisibleEditorContexts() {
  const elements = Array.from(document.querySelectorAll<HTMLElement>('.protyle'))
    .filter(element => !element.classList.contains('fn__none'))

  const contexts: EditorContext[] = []
  const seenRootIds = new Set<string>()

  elements.forEach((element) => {
    const context = createEditorContextFromElement(element)
    if (!context || seenRootIds.has(context.rootId)) {
      return
    }

    seenRootIds.add(context.rootId)
    contexts.push(context)
  })

  return contexts
}

function findContextByCurrentPageTitle(contexts: EditorContext[]) {
  const currentPageTitle = document.title.split(' - ')[0]?.trim()
  if (!currentPageTitle) {
    return null
  }

  return contexts.find(context => context.title === currentPageTitle) ?? null
}

function isSupportedBlockType(blockType: string, options: SearchOptions) {
  if (SUPPORTED_NODE_TYPES.has(blockType)) {
    return true
  }

  return options.includeCodeBlock && blockType === CODE_NODE_TYPE
}

function getOwnedTextNodes(blockElement: HTMLElement) {
  const editableRoots = getEditableRoots(blockElement)
  if (!editableRoots.length) {
    return []
  }

  return editableRoots.flatMap(root => collectTextNodes(root, blockElement))
}

function getEditableRoots(blockElement: HTMLElement) {
  const candidates = Array.from(blockElement.querySelectorAll<HTMLElement>('[contenteditable="true"]'))
  return candidates.filter((candidate) => {
    if (candidate.closest('.protyle-attr')) {
      return false
    }

    return getOwnerBlock(candidate) === blockElement
  })
}

function collectTextNodes(root: HTMLElement, ownerBlock: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!(node instanceof Text) || !node.nodeValue?.length) {
        return NodeFilter.FILTER_REJECT
      }

      const parentElement = node.parentElement
      if (!parentElement || parentElement.closest('.protyle-attr')) {
        return NodeFilter.FILTER_REJECT
      }

      if (getOwnerBlock(parentElement) !== ownerBlock) {
        return NodeFilter.FILTER_REJECT
      }

      return NodeFilter.FILTER_ACCEPT
    },
  })

  const textNodes: Text[] = []
  let currentNode = walker.nextNode()
  while (currentNode) {
    textNodes.push(currentNode as Text)
    currentNode = walker.nextNode()
  }

  return textNodes
}

function getOwnerBlock(element: Element) {
  return element.closest<HTMLElement>('[data-node-id][data-type]')
}

function getSelectionRangesWithinBlock(blockElement: HTMLElement, selection: Selection) {
  const textNodes = getOwnedTextNodes(blockElement)
  const blockRange = createTextNodesRange(textNodes)
  if (!blockRange) {
    return []
  }

  const blockTextLength = blockRange.toString().length
  const ranges: TextOffsetRange[] = []
  for (let index = 0; index < selection.rangeCount; index += 1) {
    const selectionRange = selection.getRangeAt(index)
    const startRelation = blockRange.comparePoint(selectionRange.startContainer, selectionRange.startOffset)
    const endRelation = blockRange.comparePoint(selectionRange.endContainer, selectionRange.endOffset)
    if (startRelation === 1 || endRelation === -1) {
      continue
    }

    const start = startRelation === -1
      ? 0
      : measureTextOffset(blockRange, selectionRange.startContainer, selectionRange.startOffset)
    const end = endRelation === 1
      ? blockTextLength
      : measureTextOffset(blockRange, selectionRange.endContainer, selectionRange.endOffset)
    if (end <= start) {
      continue
    }

    ranges.push({ start, end })
  }

  return mergeTextOffsetRanges(ranges)
}

function createTextNodesRange(textNodes: Text[]) {
  const firstNode = textNodes[0]
  const lastNode = textNodes[textNodes.length - 1]
  if (!firstNode || !lastNode) {
    return null
  }

  const range = document.createRange()
  range.setStart(firstNode, 0)
  range.setEnd(lastNode, lastNode.nodeValue?.length ?? 0)
  return range
}

function measureTextOffset(blockRange: Range, container: Node, offset: number) {
  const range = document.createRange()
  range.setStart(blockRange.startContainer, blockRange.startOffset)
  range.setEnd(container, offset)
  return range.toString().length
}

function mergeTextOffsetRanges(ranges: TextOffsetRange[]) {
  const sortedRanges = [...ranges].sort((left, right) => left.start - right.start)
  const mergedRanges: TextOffsetRange[] = []

  sortedRanges.forEach((range) => {
    const previousRange = mergedRanges[mergedRanges.length - 1]
    if (!previousRange || range.start > previousRange.end) {
      mergedRanges.push({ ...range })
      return
    }

    previousRange.end = Math.max(previousRange.end, range.end)
  })

  return mergedRanges
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
