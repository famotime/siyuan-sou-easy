import type {
  EditorContext,
  ScrollMatchResult,
  SearchMatch,
} from '../types'
import { resolveEditorScrollContainer } from '../editor/scroll-container'
import { t } from '@/i18n/runtime'
import type { SearchReplaceState } from './state'

interface PendingNavigationControllerOptions {
  getCurrentMatch: () => SearchMatch | null
  resolveEditorContext: () => EditorContext | null
  scrollMatchIntoView: (
    context: EditorContext,
    match: SearchMatch | null,
    mode?: 'always' | 'if-needed',
  ) => ScrollMatchResult
  state: SearchReplaceState
}

export function createPendingNavigationController({
  getCurrentMatch,
  resolveEditorContext,
  scrollMatchIntoView,
  state,
}: PendingNavigationControllerOptions) {
  let pendingNavigationTimer = 0
  let pendingNavigationAttempts = 0
  let pendingNavigationMatchId = ''

  function beginPendingNavigation(match: SearchMatch) {
    pendingNavigationMatchId = match.id
    pendingNavigationAttempts = 0
    state.navigationHint = t('navigationPending')
  }

  function clearPendingNavigation() {
    window.clearTimeout(pendingNavigationTimer)
    pendingNavigationTimer = 0
    pendingNavigationAttempts = 0
    pendingNavigationMatchId = ''
    state.navigationHint = ''
  }

  function retryPendingNavigation() {
    const currentMatch = getCurrentMatch()
    const context = resolveEditorContext()
    if (!state.visible || !context || !currentMatch || currentMatch.id !== pendingNavigationMatchId) {
      clearPendingNavigation()
      return
    }

    const directScrollResult = scrollMatchIntoView(context, currentMatch, 'always')
    if (directScrollResult !== 'missing') {
      clearPendingNavigation()
      return
    }

    if (!scrollApproximateMatchIntoView(context, currentMatch)) {
      clearPendingNavigation()
      return
    }

    pendingNavigationAttempts += 1
    if (pendingNavigationAttempts >= 40) {
      clearPendingNavigation()
      return
    }

    window.clearTimeout(pendingNavigationTimer)
    pendingNavigationTimer = window.setTimeout(() => {
      retryPendingNavigation()
    }, 120)
  }

  function retryPendingNavigationForMatch(matchId: string) {
    if (pendingNavigationMatchId === matchId) {
      retryPendingNavigation()
    }
  }

  function reset() {
    clearPendingNavigation()
  }

  return {
    beginPendingNavigation,
    clearPendingNavigation,
    reset,
    retryPendingNavigation,
    retryPendingNavigationForMatch,
  }

  function scrollApproximateMatchIntoView(context: EditorContext, match: SearchMatch) {
    const scrollContainer = resolveEditorScrollContainer(context)
    if (!scrollContainer || state.searchableBlockCount <= 0) {
      return false
    }

    const scrollHeight = Math.max(scrollContainer.scrollHeight || 0, scrollContainer.clientHeight || 0, 1)
    const clientHeight = Math.max(scrollContainer.clientHeight || 0, 1)
    const maxScrollTop = Math.max(0, scrollHeight - clientHeight)
    const loadedBlockRange = resolveLoadedBlockRange(context)
    const nextScrollTop = resolveApproximateScrollTop(match, {
      clientHeight,
      loadedBlockRange,
      maxScrollTop,
      scrollHeight,
    })

    if (typeof scrollContainer.scrollTo === 'function') {
      scrollContainer.scrollTo({
        behavior: 'auto',
        top: nextScrollTop,
      })
    } else {
      scrollContainer.scrollTop = nextScrollTop
    }

    return true
  }

  function resolveApproximateScrollTop(
    match: SearchMatch,
    {
      clientHeight,
      loadedBlockRange,
      maxScrollTop,
      scrollHeight,
    }: {
      clientHeight: number
      loadedBlockRange: { max: number, min: number } | null
      maxScrollTop: number
      scrollHeight: number
    },
  ) {
    if (loadedBlockRange) {
      if (match.blockIndex > loadedBlockRange.max) {
        return maxScrollTop
      }

      if (match.blockIndex < loadedBlockRange.min) {
        return 0
      }
    }

    const ratio = (match.blockIndex + 0.5) / state.searchableBlockCount
    return Math.max(
      0,
      Math.min(
        maxScrollTop,
        (ratio * scrollHeight) - (clientHeight / 2),
      ),
    )
  }

  function resolveLoadedBlockRange(context: EditorContext) {
    const blockIndexById = new Map(state.minimapBlocks.map(block => [block.blockId, block.blockIndex]))
    if (!blockIndexById.size) {
      return null
    }

    const loadedIndexes = Array.from(
      context.protyle.querySelectorAll<HTMLElement>('.protyle-wysiwyg [data-node-id]'),
    )
      .map((element) => {
        const blockId = element.dataset.nodeId
        return blockId ? blockIndexById.get(blockId) : undefined
      })
      .filter((blockIndex): blockIndex is number => typeof blockIndex === 'number')

    if (!loadedIndexes.length) {
      return null
    }

    return {
      max: Math.max(...loadedIndexes),
      min: Math.min(...loadedIndexes),
    }
  }
}
