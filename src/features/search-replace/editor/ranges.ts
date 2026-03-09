import { getBlockElement, getOwnedTextNodes } from './blocks'
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
