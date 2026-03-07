import type {
  EditorContext,
  ReplacementOutcome,
  SearchMatch,
  SearchOptions,
  SearchableBlock,
} from './types'

const MATCH_CLASS = 'sfsr-block-match'
const CURRENT_MATCH_CLASS = 'sfsr-block-current'
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

export function getCurrentSelectionText() {
  return window.getSelection()?.toString() ?? ''
}

export function getActiveEditorContext(): EditorContext | null {
  const selection = window.getSelection()
  const anchorElement = selection?.anchorNode instanceof Element
    ? selection.anchorNode
    : selection?.anchorNode?.parentElement

  const candidates = [
    anchorElement?.closest('.protyle'),
    (document.activeElement as HTMLElement | null)?.closest?.('.protyle'),
    document.querySelector('.layout__wnd--active .protyle'),
    document.querySelector('.protyle:not(.fn__none)'),
  ]

  for (const candidate of candidates) {
    if (!(candidate instanceof HTMLElement)) {
      continue
    }

    const rootId = getRootId(candidate)
    if (!rootId) {
      continue
    }

    return {
      protyle: candidate,
      rootId,
      title: getEditorTitle(candidate),
    }
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
  return context.protyle.querySelector<HTMLElement>(`[data-node-id="${blockId}"]`)
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

  const matchedBlockIds = new Set(matches.map(match => match.blockId))
  matchedBlockIds.forEach((blockId) => {
    getBlockElement(context, blockId)?.classList.add(MATCH_CLASS)
  })

  if (currentMatch) {
    getBlockElement(context, currentMatch.blockId)?.classList.add(CURRENT_MATCH_CLASS)
  }
}

export function clearSearchDecorations(context?: EditorContext | null) {
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

    location.node.nodeValue = [
      text.slice(0, location.startOffset),
      replacementText,
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
