import type { SearchMatch } from './types'

export function isAttributeViewMatch(match: SearchMatch | null | undefined) {
  return match?.sourceKind === 'attribute-view'
}

export function hasAttributeViewMatches(matches: SearchMatch[]) {
  return matches.some(match => isAttributeViewMatch(match))
}
