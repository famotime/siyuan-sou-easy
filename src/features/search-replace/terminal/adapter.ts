import type { SearchMatch } from '../types'
import type { TerminalSearchResult } from './registry'

export function mapTerminalSearchResult(result: TerminalSearchResult, surfaceId: string): {
  currentIndex: number
  error: string
  matches: SearchMatch[]
} {
  return {
    currentIndex: result.currentIndex,
    error: result.error,
    matches: result.matches.map((match, index) => ({
      blockId: `${surfaceId}:${match.row}`,
      blockIndex: match.row,
      blockType: 'TerminalRow',
      end: match.col + match.length,
      id: `${surfaceId}:${match.id}:${index}`,
      matchedText: match.matchedText,
      previewText: match.previewText,
      replaceable: false,
      rootId: surfaceId,
      sourceKind: 'terminal',
      start: match.col,
    })),
  }
}
