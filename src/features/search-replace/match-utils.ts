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
