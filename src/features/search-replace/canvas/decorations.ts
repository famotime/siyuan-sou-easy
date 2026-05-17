import type {
  EditorContext,
  SearchMatch,
  ScrollMatchResult,
} from '../types'

export function syncCanvasSearchDecorations({
  context,
  currentMatch,
  matches,
}: {
  context: EditorContext
  currentMatch: SearchMatch | null
  matches: SearchMatch[]
}) {
  context.canvas?.host.syncDecorations(
    matches
      .filter(match => match.sourceKind === 'canvas' && match.canvas?.targetId)
      .map(match => ({
        current: currentMatch?.id === match.id,
        end: match.end,
        start: match.start,
        targetId: match.canvas?.targetId ?? '',
      })),
  )
}

export function clearCanvasSearchDecorations(context?: EditorContext | null) {
  context?.canvas?.host.syncDecorations([])
}

export function scrollCanvasMatchIntoView(
  context: EditorContext,
  match: SearchMatch | null,
): ScrollMatchResult {
  const targetId = match?.canvas?.targetId
  if (!targetId || !context.canvas?.host) {
    return 'missing'
  }

  void context.canvas.host.reveal(targetId, {
    end: match.end,
    start: match.start,
  })
  return 'scrolled'
}

export function isCanvasMatchVisible(context: EditorContext, match: SearchMatch | null) {
  return Boolean(context.canvas?.host && match?.canvas?.targetId)
}
