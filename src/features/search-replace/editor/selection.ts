import { getOwnedTextNodes } from './blocks'
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

function getSelectionScopeFromSelectedBlocks(context: EditorContext): SelectionScope {
  const scope: SelectionScope = new Map()
  const selectedBlocks = Array.from(
    context.protyle.querySelectorAll<HTMLElement>('.protyle-wysiwyg .protyle-wysiwyg--select[data-node-id][data-type]'),
  )
  const seen = new Set<string>()

  selectedBlocks.forEach((blockElement) => {
    const blockId = blockElement.dataset.nodeId
    if (!blockId || seen.has(blockId)) {
      return
    }

    seen.add(blockId)
    const textLength = getOwnedTextNodes(blockElement)
      .reduce((length, node) => length + (node.nodeValue?.length ?? 0), 0)
    if (textLength <= 0) {
      return
    }

    scope.set(blockId, [{
      start: 0,
      end: textLength,
    }])
  })

  return scope
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
