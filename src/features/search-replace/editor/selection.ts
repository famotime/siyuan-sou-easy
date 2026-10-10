import {
  getBlockTextLength,
  getSearchTextNodes,
} from './blocks'
import { TABLE_NODE_TYPE } from './constants'
import type {
  EditorContext,
  SelectionScope,
  TextOffsetRange,
} from '../types'

const BLOCK_SELECTOR = '[data-node-id][data-type]'

export function getCurrentSelectionText() {
  return window.getSelection()?.toString() ?? ''
}

export function getCurrentSelectionScope(context: EditorContext): SelectionScope {
  const selection = window.getSelection()
  // A collapsed caret cannot intersect any text node, so the scan below would always
  // come back empty. Skipping it keeps plain typing off the document-sized walk.
  if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
    const textSelectionScope = getSelectionScopeFromTextRanges(context, selection)
    if (textSelectionScope.size > 0) {
      return textSelectionScope
    }
  }

  return getSelectionScopeFromSelectedBlocks(context)
}

function getSelectionScopeFromTextRanges(context: EditorContext, selection: Selection): SelectionScope {
  const scope: SelectionScope = new Map()
  collectSelectionCandidateBlocks(context, selection).forEach((blockElement) => {
    const blockId = blockElement.dataset.nodeId
    if (!blockId) {
      return
    }

    const ranges = getSelectionRangesWithinBlock(blockElement, selection)
    if (!ranges.length) {
      return
    }

    scope.set(blockId, ranges)
  })

  return scope
}

/**
 * Blocks whose own text can intersect the selection.
 *
 * Blocks are enumerated in document order from the selection's start block through its
 * end block, so a caret costs one block and a dragged selection costs the selected
 * blocks instead of every block of the editor.
 *
 * This relies on the editor DOM keeping a block's own text ahead of its nested blocks
 * (SiYuan renders a list item's text before its children), so walking the selection's
 * span reaches every block that owns selected text. The endpoints' table ancestors are
 * added explicitly because a table block owns the text of the cells nested inside it.
 */
function collectSelectionCandidateBlocks(context: EditorContext, selection: Selection) {
  const candidates: HTMLElement[] = []
  const seen = new Set<HTMLElement>()

  const addBlock = (blockElement: HTMLElement | null) => {
    if (!blockElement || seen.has(blockElement) || !context.protyle.contains(blockElement)) {
      return
    }

    seen.add(blockElement)
    candidates.push(blockElement)
  }

  const addBlockWithTableAncestors = (blockElement: HTMLElement) => {
    addBlock(blockElement)
    let ancestor = getOwnerBlockElement(blockElement.parentElement)
    while (ancestor) {
      if (ancestor.dataset.type === TABLE_NODE_TYPE) {
        addBlock(ancestor)
      }

      ancestor = getOwnerBlockElement(ancestor.parentElement)
    }
  }

  for (let index = 0; index < selection.rangeCount; index += 1) {
    const selectionRange = selection.getRangeAt(index)
    const startBlock = resolveEditorBlock(context, selectionRange.startContainer)
    const endBlock = resolveEditorBlock(context, selectionRange.endContainer)
    // Without an in-editor start block the selection reaches outside of this editor,
    // so fall back to walking the whole editor from its root.
    const walkStart = startBlock ?? context.protyle

    collectBlocksInRange(context.protyle, walkStart, endBlock).forEach(addBlockWithTableAncestors)
  }

  return candidates
}

function resolveEditorBlock(context: EditorContext, node: Node | null | undefined) {
  const blockElement = getOwnerBlockElement(node)
  return blockElement && context.protyle.contains(blockElement) ? blockElement : null
}

function getOwnerBlockElement(node: Node | null | undefined) {
  const element = node instanceof Element ? node : node?.parentElement
  return element?.closest<HTMLElement>(BLOCK_SELECTOR) ?? null
}

function collectBlocksInRange(scopeRoot: Element, startBlock: Element, endBlock: Element | null) {
  const blocks: HTMLElement[] = []
  const walker = document.createTreeWalker(scopeRoot, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      return node instanceof HTMLElement && node.matches(BLOCK_SELECTOR)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP
    },
  })

  walker.currentNode = startBlock
  let currentNode: Node | null = startBlock
  while (currentNode) {
    if (currentNode instanceof HTMLElement && currentNode.matches(BLOCK_SELECTOR)) {
      // Keep walking into the end block: blocks nested inside it can still sit before
      // the selection's end, such as a nested paragraph ahead of the block's .protyle-attr.
      if (endBlock && isAfterInDocument(currentNode, endBlock)) {
        break
      }

      blocks.push(currentNode)
    }

    currentNode = walker.nextNode()
  }

  return blocks
}

function isAfterInDocument(element: Element, reference: Element) {
  const position = reference.compareDocumentPosition(element)
  return Boolean(position & Node.DOCUMENT_POSITION_FOLLOWING)
    && !(position & Node.DOCUMENT_POSITION_CONTAINED_BY)
}

function getSelectionScopeFromSelectedBlocks(context: EditorContext): SelectionScope {
  const scope: SelectionScope = new Map()
  const selectedElements = Array.from(
    context.protyle.querySelectorAll<HTMLElement>('.protyle-wysiwyg .protyle-wysiwyg--select'),
  )
  const seen = new Set<string>()

  selectedElements.forEach((selectedElement) => {
    const blockElements = resolveSelectedBlockElements(selectedElement)
    blockElements.forEach((blockElement) => {
      const blockId = blockElement.dataset.nodeId
      if (!blockId || seen.has(blockId)) {
        return
      }

      const textLength = getBlockTextLength(blockElement)
      if (textLength <= 0) {
        return
      }

      seen.add(blockId)
      scope.set(blockId, [{
        start: 0,
        end: textLength,
      }])
    })
  })

  return scope
}

function resolveSelectedBlockElements(selectedElement: HTMLElement) {
  const primaryBlock = selectedElement.matches('[data-node-id][data-type]')
    ? selectedElement
    : selectedElement.closest<HTMLElement>('[data-node-id][data-type]')

  if (primaryBlock) {
    if (getBlockTextLength(primaryBlock) > 0) {
      return [primaryBlock]
    }

    const descendantBlocks = getDescendantBlockElements(primaryBlock)
      .filter(blockElement => getBlockTextLength(blockElement) > 0)
    if (descendantBlocks.length > 0) {
      return descendantBlocks
    }
  }

  return getDescendantBlockElements(selectedElement)
    .filter(blockElement => getBlockTextLength(blockElement) > 0)
}

function getDescendantBlockElements(rootElement: HTMLElement) {
  return Array.from(rootElement.querySelectorAll<HTMLElement>('[data-node-id][data-type]'))
}

function getSelectionRangesWithinBlock(blockElement: HTMLElement, selection: Selection) {
  const textNodes = getSearchTextNodes(blockElement)
  if (!textNodes.length) {
    return []
  }

  const ranges: TextOffsetRange[] = []
  for (let index = 0; index < selection.rangeCount; index += 1) {
    const selectionRange = selection.getRangeAt(index)
    ranges.push(...getIntersectedTextRanges(textNodes, selectionRange))
  }

  return mergeTextOffsetRanges(ranges)
}

function getIntersectedTextRanges(textNodes: Text[], selectionRange: Range) {
  const ranges: TextOffsetRange[] = []
  let cursor = 0

  textNodes.forEach((textNode) => {
    const text = textNode.nodeValue ?? ''
    const nextCursor = cursor + text.length
    if (!text.length) {
      cursor = nextCursor
      return
    }

    const nodeRange = document.createRange()
    nodeRange.selectNodeContents(textNode)

    const startRelation = nodeRange.comparePoint(selectionRange.startContainer, selectionRange.startOffset)
    const endRelation = nodeRange.comparePoint(selectionRange.endContainer, selectionRange.endOffset)
    if (startRelation === 1 || endRelation === -1) {
      cursor = nextCursor
      return
    }

    const start = startRelation === -1
      ? 0
      : measureTextOffset(nodeRange, selectionRange.startContainer, selectionRange.startOffset)
    const end = endRelation === 1
      ? text.length
      : measureTextOffset(nodeRange, selectionRange.endContainer, selectionRange.endOffset)
    if (end > start) {
      ranges.push({
        start: cursor + start,
        end: cursor + end,
      })
    }

    cursor = nextCursor
  })

  return ranges
}

function measureTextOffset(baseRange: Range, container: Node, offset: number) {
  const range = document.createRange()
  range.setStart(baseRange.startContainer, baseRange.startOffset)
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
