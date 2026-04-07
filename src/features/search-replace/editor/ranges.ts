import { getBlockElement, getOwnedTextNodes, getSearchTextNodes } from './blocks'
import { findAttributeViewCellElements } from './attribute-view'
import type {
  EditorContext,
  SearchMatch,
} from '../types'

interface TextRangeLocation {
  node: Text
  startOffset: number
  endOffset: number
}

interface TextPoint {
  node: Text
  offset: number
}

export function locateTextRange(context: EditorContext, match: SearchMatch) {
  if (match.sourceKind === 'attribute-view') {
    return locateAttributeViewTextRange(context, match)
  }

  if (match.blockType === 'NodeTable') {
    const tableRange = locateTableTextRange(context, match)
    if (tableRange) {
      return tableRange
    }
  }

  const blockElement = getBlockElement(context, match.blockId)
  if (!blockElement) {
    return null
  }

  const textNodes = getSearchTextNodes(blockElement)
  if (!textNodes.length) {
    return null
  }

  const directRange = createRangeFromOffsets(textNodes, match.start, match.end)
  if (directRange?.toString() === match.matchedText) {
    return directRange
  }

  return locateTextRangeInTextNodes(textNodes, match.matchedText, match.start)
}

export function locateRangeInSingleTextNode(blockElement: HTMLElement, start: number, end: number): TextRangeLocation | null {
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

function locateAttributeViewTextRange(context: EditorContext, match: SearchMatch) {
  const cells = findAttributeViewCellElements(context, match)
  for (const cell of cells) {
    const range = locateTextRangeInContainer(cell, match.matchedText, match.start)
    if (range) {
      return range
    }
  }

  return null
}

function locateTableTextRange(context: EditorContext, match: SearchMatch) {
  const cell = findTableCellElement(context, match)
  if (!cell) {
    return null
  }

  const preferredStart = typeof match.table?.cellStart === 'number'
    ? Math.max(0, match.start - match.table.cellStart)
    : match.start
  return locateTextRangeInContainer(cell, match.matchedText, preferredStart)
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

function locateTextRangeInContainer(container: HTMLElement, matchedText: string, preferredStart: number) {
  const textNodes = collectDescendantTextNodes(container)
  return locateTextRangeInTextNodes(textNodes, matchedText, preferredStart)
}

function locateTextRangeInTextNodes(textNodes: Text[], matchedText: string, preferredStart: number) {
  if (!textNodes.length || !matchedText) {
    return null
  }

  const combinedText = textNodes
    .map(node => node.nodeValue ?? '')
    .join('')
  const start = resolveMatchStart(combinedText, matchedText, preferredStart)
  if (start < 0) {
    return null
  }

  return createRangeFromOffsets(textNodes, start, start + matchedText.length)
}

function createRangeFromOffsets(textNodes: Text[], startOffset: number, endOffset: number) {
  const startPoint = locateTextPoint(textNodes, startOffset)
  const endPoint = locateTextPoint(textNodes, endOffset)
  if (!startPoint || !endPoint) {
    return null
  }

  const range = document.createRange()
  range.setStart(startPoint.node, startPoint.offset)
  range.setEnd(endPoint.node, endPoint.offset)
  return range
}

function collectDescendantTextNodes(container: HTMLElement) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!(node instanceof Text) || !node.nodeValue?.trim()) {
        return NodeFilter.FILTER_REJECT
      }

      const parentElement = node.parentElement
      if (!parentElement || parentElement.closest('.protyle-attr, .fn__none, svg, style, script')) {
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

function resolveMatchStart(text: string, matchedText: string, preferredStart: number) {
  if (!matchedText || !text.includes(matchedText)) {
    return -1
  }

  if (preferredStart >= 0 && text.slice(preferredStart, preferredStart + matchedText.length) === matchedText) {
    return preferredStart
  }

  const indexes: number[] = []
  let fromIndex = 0
  while (fromIndex <= text.length - matchedText.length) {
    const index = text.indexOf(matchedText, fromIndex)
    if (index < 0) {
      break
    }

    indexes.push(index)
    fromIndex = index + matchedText.length
  }

  if (!indexes.length) {
    return -1
  }

  if (indexes.length === 1) {
    return indexes[0]
  }

  return indexes.reduce((bestIndex, currentIndex) => {
    return Math.abs(currentIndex - preferredStart) < Math.abs(bestIndex - preferredStart)
      ? currentIndex
      : bestIndex
  })
}

function findTableCellElement(context: EditorContext, match: SearchMatch) {
  const tableBlock = getBlockElement(context, match.blockId)
  if (!tableBlock) {
    return null
  }

  const cellId = match.table?.cellId?.trim()
  if (cellId) {
    const exactCell = tableBlock.querySelector<HTMLElement>(`[data-node-id="${cellId}"][data-type="NodeTableCell"]`)
      ?? tableBlock.querySelector<HTMLElement>(`[data-node-id="${cellId}"].table__cell`)
    if (exactCell) {
      return exactCell
    }
  }

  const rowIndex = match.table?.rowIndex
  const columnIndex = match.table?.columnIndex
  if (typeof rowIndex !== 'number' || typeof columnIndex !== 'number') {
    return null
  }

  const rows = getTableRowElements(tableBlock)
  const targetRow = rows[rowIndex]
  if (!targetRow) {
    return null
  }

  const rowCells = Array.from(targetRow.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement)
    .filter(child => child.matches('[data-type="NodeTableCell"], .table__cell, td, th'))

  return rowCells[columnIndex] ?? null
}

function getTableRowElements(tableBlock: HTMLElement) {
  const explicitRows = Array.from(tableBlock.querySelectorAll<HTMLElement>('.table__row'))
  if (explicitRows.length) {
    return explicitRows
  }

  const nativeRows = Array.from(tableBlock.querySelectorAll<HTMLElement>('tr'))
  if (nativeRows.length) {
    return nativeRows
  }

  return []
}
