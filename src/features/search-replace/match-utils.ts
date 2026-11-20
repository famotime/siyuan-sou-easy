import type { SearchMatch } from './types'

// 从 editor/decorations.ts 迁入（RF-105）：纯文本预览构造工具，
// 消除 search-engine / attribute-view 对 editor 模块的反向依赖。
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

export function isAttributeViewMatch(match: SearchMatch | null | undefined) {
  return match?.sourceKind === 'attribute-view'
}

export function hasAttributeViewMatches(matches: SearchMatch[]) {
  return matches.some((match) => isAttributeViewMatch(match))
}

export function isCanvasMatch(match: SearchMatch | null | undefined) {
  return match?.sourceKind === 'canvas'
}

export function hasCanvasMatches(matches: SearchMatch[]) {
  return matches.some((match) => isCanvasMatch(match))
}

export function hasUnsupportedCanvasReplacementMatches(matches: SearchMatch[]) {
  return matches.some((match) => isCanvasMatch(match) && !match.replaceable)
}

export interface PreviewSegment {
  text: string
  isMatch: boolean
}

export function parsePreviewSegments(
  previewText: string,
  matchedText?: string,
): PreviewSegment[] {
  if (!previewText) {
    return []
  }

  const targetMatch = matchedText ? matchedText.replace(/\s+/g, ' ') : ''

  if (targetMatch) {
    const bracketedMatch = `[${targetMatch}]`
    const index = previewText.indexOf(bracketedMatch)
    if (index !== -1) {
      const segments: PreviewSegment[] = []
      if (index > 0) {
        segments.push({
          text: previewText.slice(0, index),
          isMatch: false,
        })
      }
      segments.push({
        text: targetMatch,
        isMatch: true,
      })
      if (index + bracketedMatch.length < previewText.length) {
        segments.push({
          text: previewText.slice(index + bracketedMatch.length),
          isMatch: false,
        })
      }
      return segments
    }
  }

  const matchRegex = /\[(.*?)\]/
  const match = matchRegex.exec(previewText)
  if (match && match.index !== undefined) {
    const segments: PreviewSegment[] = []
    if (match.index > 0) {
      segments.push({
        text: previewText.slice(0, match.index),
        isMatch: false,
      })
    }
    segments.push({
      text: match[1],
      isMatch: true,
    })
    const restIndex = match.index + match[0].length
    if (restIndex < previewText.length) {
      segments.push({
        text: previewText.slice(restIndex),
        isMatch: false,
      })
    }
    return segments
  }

  return [{
    text: previewText,
    isMatch: false,
  }]
}

