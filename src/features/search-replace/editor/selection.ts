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
