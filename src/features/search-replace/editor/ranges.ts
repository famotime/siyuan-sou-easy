import type {
  EditorContext,
  SearchMatch,
} from '../types'
import type { EditorBlockRoots } from './blocks'
import { findAttributeViewCellElements } from './attribute-view'
import {

  getBlockElement,
  getOwnedTextNodes,
  getSearchTextNodes,
} from './blocks'
import { findTableCellElementByMetadata } from './table-dom'
import { collectVisibleTextNodes } from './text-nodes'

interface TextRangeLocation {
  node: Text
  startOffset: number
  endOffset: number
}

interface TextPoint {
  node: Text
  offset: number
}

export function locateTextRange(context: EditorContext, match: SearchMatch, roots?: EditorBlockRoots) {
  if (match.sourceKind === 'attribute-view') {
    return locateAttributeViewTextRange(context, match, roots)
  }

  const blockElement = getBlockElement(context, match.blockId, roots)
  if (!blockElement) {
    return null
  }

  // 表格块优先尝试单元格级精准 Range 定位
  if (match.blockType === 'NodeTable' || match.table) {
    const tableRange = locateTableTextRange(context, match, roots)
    if (tableRange) {
      return tableRange
    }
  }

  const textNodes = getSearchTextNodes(blockElement)
  if (!textNodes.length) {
    return null
  }

  const directRange = locateTextRangeInTextNodes(textNodes, match.matchedText, match.occ)
  if (directRange) {
    return directRange
  }

  return locateFallbackTextRange(textNodes, match)
}

export function locateRangeInSingleTextNode(blockElement: HTMLElement, matchedText: string, occ: number): TextRangeLocation | null {
  const allTextNodes = getSearchTextNodes(blockElement)
  const range = locateTextRangeInTextNodes(allTextNodes, matchedText, occ)
  if (!range) {
    return null
  }

  if (range.startContainer !== range.endContainer) {
    return null
  }

  const ownedNodes = new Set(getOwnedTextNodes(blockElement))
  if (!ownedNodes.has(range.startContainer as Text)) {


    return null
  }

  return {
    node: range.startContainer as Text,
    startOffset: range.startOffset,
    endOffset: range.endOffset,
  }
}

function locateAttributeViewTextRange(context: EditorContext, match: SearchMatch, roots?: EditorBlockRoots) {
  const cells = findAttributeViewCellElements(context, match, roots)
  for (const cell of cells) {
    const range = locateTextRangeInContainer(cell, match.matchedText, match.occ)
    if (range) {
      return range
    }
  }

  return null
}

function locateTableTextRange(context: EditorContext, match: SearchMatch, roots?: EditorBlockRoots) {
  const cell = findTableCellElement(context, match, roots)
  if (!cell) {
    return null
  }

  const cellTextNodes = collectVisibleTextNodes(cell)
  if (!cellTextNodes.length) {
    return null
  }

  const combinedCellText = cellTextNodes.map((node) => node.nodeValue ?? '').join('')
  const cellOcc = resolveCellOcc(match, combinedCellText)
  const cellRange = locateTextRangeInTextNodes(cellTextNodes, match.matchedText, cellOcc)
  if (cellRange) {
    return cellRange
  }

  return locateFallbackTextRange(cellTextNodes, match)
}

function resolveCellOcc(match: SearchMatch, cellText: string): number {
  if (!match.table || typeof match.table.cellStart !== 'number' || match.table.cellStart < 0) {
    return 0
  }

  const needle = match.matchedText
  if (!needle) return 0

  const offsetInCell = Math.max(0, match.start - match.table.cellStart)
  let occ = 0
  let idx = cellText.indexOf(needle)
  while (idx !== -1 && idx < offsetInCell) {
    occ++
    idx = cellText.indexOf(needle, idx + needle.length)
  }

  return occ
}

function locateFallbackTextRange(textNodes: Text[], match: SearchMatch) {
  const needle = match.matchedText
  if (!textNodes.length || !needle) {
    return null
  }

  const combinedText = textNodes.map((node) => node.nodeValue ?? '').join('')
  const start = resolveMatchStart(combinedText, needle, match.occ)
  if (start < 0) {
    return null
  }

  return createRangeFromOffsets(textNodes, start, start + needle.length)
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

function locateTextRangeInContainer(container: HTMLElement, matchedText: string, occ: number) {
  const textNodes = collectVisibleTextNodes(container)
  return locateTextRangeInTextNodes(textNodes, matchedText, occ)
}

function locateTextRangeInTextNodes(textNodes: Text[], matchedText: string, occ: number) {
  if (!textNodes.length || !matchedText) {
    return null
  }

  const combinedText = textNodes
    .map((node) => node.nodeValue ?? '')
    .join('')
  const start = resolveMatchStart(combinedText, matchedText, occ)
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

function resolveMatchStart(text: string, matchedText: string, occ: number) {
  if (typeof text !== 'string' || typeof matchedText !== 'string' || !matchedText.length) {
    return -1
  }

  // 优先精确区分大小写查找
  let currentOcc = 0
  let idx = text.indexOf(matchedText)
  while (idx !== -1) {
    if (currentOcc === occ) {
      return idx
    }
    currentOcc++
    idx = text.indexOf(matchedText, idx + matchedText.length)
  }

  // 大小写不敏感查找与就近回退（借鉴 highlight-search resolveDomHit 思想）
  const lowerText = text.toLowerCase()
  const lowerMatched = matchedText.toLowerCase()
  if (!lowerText.includes(lowerMatched)) {
    return -1
  }

  currentOcc = 0
  idx = lowerText.indexOf(lowerMatched)
  let bestIdx = -1
  let minOccDiff = Infinity

  while (idx !== -1) {
    const diff = Math.abs(currentOcc - occ)
    if (diff < minOccDiff) {
      minOccDiff = diff
      bestIdx = idx
    }
    if (currentOcc === occ) {
      return idx
    }
    currentOcc++
    idx = lowerText.indexOf(lowerMatched, idx + lowerMatched.length)
  }

  return bestIdx
}

function findTableCellElement(context: EditorContext, match: SearchMatch, roots?: EditorBlockRoots) {
  const tableBlock = getBlockElement(context, match.blockId, roots)
  if (!tableBlock) {
    return null
  }

  return findTableCellElementByMetadata(tableBlock, match)
}
