import {
  getBlockTextLength,
  getOwnedTextNodes,
  getUniqueBlockElements,
} from './blocks'
import type {
  EditorContext,
  SelectionScope,
  TextOffsetRange,
} from '../types'

export function getCurrentSelectionText() {
  return window.getSelection()?.toString() ?? ''
}

export function getCurrentSelectionScope(context: EditorContext): SelectionScope {
  const selection = window.getSelection()
  const textSelectionScope = selection && selection.rangeCount > 0
    ? getSelectionScopeFromTextRanges(context, selection)
    : new Map()
  if (textSelectionScope.size > 0) {
    return textSelectionScope
  }

  return getSelectionScopeFromSelectedBlocks(context)
}

function getSelectionScopeFromTextRanges(context: EditorContext, selection: Selection): SelectionScope {
  const scope: SelectionScope = new Map()
  getUniqueBlockElements(context.protyle).forEach((blockElement) => {
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
  const textNodes = getOwnedTextNodes(blockElement)
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
