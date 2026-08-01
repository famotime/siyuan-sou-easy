import type { SearchMatch } from './types'

export function isAttributeViewMatch(match: SearchMatch | null | undefined) {
  return match?.sourceKind === 'attribute-view'
}

export function hasAttributeViewMatches(matches: SearchMatch[]) {
  return matches.some(match => isAttributeViewMatch(match))
}

export function isCanvasMatch(match: SearchMatch | null | undefined) {
  return match?.sourceKind === 'canvas'
}

export function hasCanvasMatches(matches: SearchMatch[]) {
  return matches.some(match => isCanvasMatch(match))
}

export function hasUnsupportedCanvasReplacementMatches(matches: SearchMatch[]) {
  return matches.some(match => isCanvasMatch(match) && !match.replaceable)
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
        segments.push({ text: previewText.slice(0, index), isMatch: false })
      }
      segments.push({ text: targetMatch, isMatch: true })
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
      segments.push({ text: previewText.slice(0, match.index), isMatch: false })
    }
    segments.push({ text: match[1], isMatch: true })
    const restIndex = match.index + match[0].length
    if (restIndex < previewText.length) {
      segments.push({ text: previewText.slice(restIndex), isMatch: false })
    }
    return segments
  }

  return [{ text: previewText, isMatch: false }]
}

