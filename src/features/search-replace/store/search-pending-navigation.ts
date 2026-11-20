import type {
  EditorContext,
  ScrollMatchResult,
  SearchMatch,
} from '../types'
import type {
  ApproximateNavigationProgress,
  DirectNavigationProgress,
} from './search-pending-navigation-state'
import type { SearchReplaceState } from './state'
import { t } from '@/i18n/runtime'
import {
  debugLog,
} from '../debug'
import { resolveEditorScrollContainer } from '../editor/scroll-container'
import { unfoldBlock } from '../kernel'
import {
  canTriggerNativeMatchNavigation,
  triggerNativeMatchNavigation,
} from '../native-navigation'
import { scrollApproximateMatchIntoView } from './approximate-scroll'
import {
  createLoadedBlockRangeResolver,
  resolveNativeNavigationDistance,
  serializeLoadedBlockRange,
} from './loaded-block-range'
import {
  advanceApproximateNavigationProgress,

  createApproximateNavigationProgress,
  createDirectNavigationProgress,

  resetApproximateNavigationProgress,
  resetDirectNavigationProgress,
  resolveApproximateNavigationTimeoutReason,
  resolveDirectNavigationAction,
} from './search-pending-navigation-state'

interface PendingNavigationControllerOptions {
  getCurrentMatch: () => SearchMatch | null
  isMatchVisible: (
    context: EditorContext,
    match: SearchMatch | null,
  ) => boolean
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
  isMatchVisible,
  resolveEditorContext,
  scrollMatchIntoView,
  state,
}: PendingNavigationControllerOptions) {
  const NATIVE_NAVIGATION_DISTANCE_THRESHOLD = 20
  const NATIVE_NAVIGATION_WAIT_MS = 1500
  const UNFOLD_SETTLE_TIMEOUT_MS = 2000

  let approximateNavigationProgress: ApproximateNavigationProgress = createApproximateNavigationProgress()
  let pendingNavigationTimer = 0
  let pendingNavigationRetryCount = 0
  let pendingNavigationMatchId = ''
  let attemptedCollapsedAncestorIds = new Set<string>()
  let directNavigationProgress: DirectNavigationProgress<EditorContext['protyleRef']> = createDirectNavigationProgress()
  let nativeNavigationAttemptedMatchId = ''
  let nativeNavigationWaitDeadline = 0
  const {
    clearLoadedBlockRangeCache,
    resolveLoadedBlockRange,
  } = createLoadedBlockRangeResolver(state)

  function beginPendingNavigation(match: SearchMatch) {
    // 先终止可能仍在等待的旧重试链，避免旧定时器与新导航交错递增计数
    window.clearTimeout(pendingNavigationTimer)
    approximateNavigationProgress = resetApproximateNavigationProgress()
    pendingNavigationMatchId = match.id
    pendingNavigationRetryCount = 0
    attemptedCollapsedAncestorIds = new Set()
    resetPendingProtyleNavigation()
    resetPendingNativeNavigation()
    state.navigationHint = t('navigationPending')
    debugLog('pending-navigation:begin', {
      blockId: match.blockId,
      blockIndex: match.blockIndex,
      matchId: match.id,
    })
  }

  function clearPendingNavigation(reason = 'reset') {
    window.clearTimeout(pendingNavigationTimer)
    approximateNavigationProgress = resetApproximateNavigationProgress()
    pendingNavigationTimer = 0
    pendingNavigationRetryCount = 0
    pendingNavigationMatchId = ''
    attemptedCollapsedAncestorIds = new Set()
    resetPendingProtyleNavigation()
    resetPendingNativeNavigation()
    state.navigationHint = ''
    debugLog('pending-navigation:clear', {
      reason,
    })
  }

  function retryPendingNavigation() {
    // 轮次边界：上一轮结束后异步加载可能已更新 DOM/滚动位置，缓存一律作废
    clearLoadedBlockRangeCache()
    const currentMatch = getCurrentMatch()
    const context = resolveEditorContext()
    if (!state.visible || !currentMatch || currentMatch.id !== pendingNavigationMatchId) {
      clearPendingNavigation('context-mismatch')
      return
    }

    if (!context) {
      if (isWaitingForNativeNavigation(currentMatch.id)) {
        debugLog('pending-navigation:native-wait', {
          attempt: pendingNavigationRetryCount,
          matchId: currentMatch.id,
          reason: 'context-missing',
          waitRemainingMs: Math.max(0, nativeNavigationWaitDeadline - Date.now()),
        })
        schedulePendingNavigationRetry()
        return
      }

      clearPendingNavigation('context-mismatch')
      return
    }

    if (attemptExpandCollapsedAncestors(currentMatch)) {
      return
    }

    pendingNavigationRetryCount += 1
    const directScrollResult = scrollMatchIntoView(context, currentMatch, 'always')
    const visibleAfterDirectScroll = directScrollResult !== 'missing' && isMatchVisible(context, currentMatch)
    debugLog('pending-navigation:direct-scroll', {
      attempt: pendingNavigationRetryCount,
      directScrollResult,
      matchId: currentMatch.id,
      visibleAfterDirectScroll,
    })
    if (visibleAfterDirectScroll) {
      clearPendingNavigation('target-visible')
      return
    }

    if (continuePendingNativeNavigation(context, currentMatch, directScrollResult)) {
      schedulePendingNavigationRetry()
      return
    }

    if (continuePendingProtyleNavigation(context, currentMatch)) {
      schedulePendingNavigationRetry()
      return
    }

    if (directScrollResult !== 'missing') {
      if (pendingNavigationRetryCount >= 5) {
        clearPendingNavigation('target-rendered')
        return
      }
      schedulePendingNavigationRetry()
      return
    }

    const approximateNavigationState = scrollApproximateMatchIntoView(
      {
        getAttempt: () => pendingNavigationRetryCount,
        getSearchableBlockCount: () => state.searchableBlockCount,
        onScrollApplied: clearLoadedBlockRangeCache,
        resolveLoadedBlockRange,
      },
      context,
      currentMatch,
    )
    if (!approximateNavigationState) {
      clearPendingNavigation('approximate-unavailable')
      return
    }

    approximateNavigationProgress = advanceApproximateNavigationProgress(
      approximateNavigationProgress,
      approximateNavigationState,
    )
    const timeoutReason = resolveApproximateNavigationTimeoutReason(approximateNavigationProgress)
    if (timeoutReason) {
      clearPendingNavigation(timeoutReason)
      return
    }

    schedulePendingNavigationRetry()
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

  function continuePendingProtyleNavigation(context: EditorContext, match: SearchMatch) {
    const directNavigation = resolveDirectProtyleNavigation(context, match)
    if (!directNavigation) {
      resetPendingProtyleNavigation()
      return false
    }

    const progressKey = serializeLoadedBlockRange(directNavigation.loadedBlockRange)
    const action = resolveDirectNavigationAction(directNavigationProgress, {
      matchId: match.id,
      progressKey,
      protyleRef: directNavigation.protyleRef,
    })

    if (action.kind === 'start') {
      try {
        directNavigation.updateIndex(directNavigation.protyleRef, match.blockId, () => {})
      } catch (error) {
        debugLog('pending-navigation:direct-protyle-fallback', {
          error: error instanceof Error ? error.message : String(error),
          matchId: match.id,
          reason: 'update-index-threw',
        })
        resetPendingProtyleNavigation()
        return false
      }

      directNavigationProgress = action.state
      debugLog('pending-navigation:direct-protyle', {
        attempt: pendingNavigationRetryCount,
        loadedBlockRange: directNavigation.loadedBlockRange,
        matchId: match.id,
        progressKey,
      })
      return true
    }

    if (action.kind === 'progress') {
      directNavigationProgress = action.state
      debugLog('pending-navigation:direct-protyle-progress', {
        attempt: pendingNavigationRetryCount,
        loadedBlockRange: directNavigation.loadedBlockRange,
        matchId: match.id,
        progressKey,
      })
      return true
    }

    if (action.kind === 'wait') {
      directNavigationProgress = action.state
      return true
    }

    debugLog('pending-navigation:direct-protyle-fallback', {
      attempt: pendingNavigationRetryCount,
      loadedBlockRange: directNavigation.loadedBlockRange,
      matchId: match.id,
      progressKey,
      reason: 'no-render-progress',
    })
    directNavigationProgress = action.state
    return false
  }

  function resolveDirectProtyleNavigation(context: EditorContext, match: SearchMatch) {
    const protyleRef = context.protyleRef
    if (!protyleRef || protyleRef.element !== context.protyle) {
      return null
    }

    const updateIndex = protyleRef.scroll?.updateIndex
    if (typeof updateIndex !== 'function') {
      return null
    }

    const scrollContainer = resolveEditorScrollContainer(context)
    const loadedBlockRange = resolveLoadedBlockRange(context, scrollContainer)
    if (
      loadedBlockRange
      && match.blockIndex >= loadedBlockRange.min
      && match.blockIndex <= loadedBlockRange.max
    ) {
      return null
    }

    return {
      loadedBlockRange,
      protyleRef,
      updateIndex,
    }
  }

  function resetPendingProtyleNavigation() {
    directNavigationProgress = resetDirectNavigationProgress()
  }

  function resetPendingNativeNavigation() {
    nativeNavigationAttemptedMatchId = ''
    nativeNavigationWaitDeadline = 0
  }

  function continuePendingNativeNavigation(
    context: EditorContext,
    match: SearchMatch,
    directScrollResult: ScrollMatchResult,
  ) {
    if (directScrollResult !== 'missing' || !canTriggerNativeMatchNavigation(match)) {
      return false
    }

    if (nativeNavigationAttemptedMatchId === match.id) {
      if (isWaitingForNativeNavigation(match.id)) {
        debugLog('pending-navigation:native-wait', {
          attempt: pendingNavigationRetryCount,
          matchId: match.id,
          reason: 'native-in-flight',
          waitRemainingMs: Math.max(0, nativeNavigationWaitDeadline - Date.now()),
        })
        return true
      }

      debugLog('pending-navigation:native-skip', {
        attempt: pendingNavigationRetryCount,
        matchId: match.id,
        reason: 'already-attempted',
      })
      return false
    }

    const loadedBlockRange = resolveLoadedBlockRange(context, resolveEditorScrollContainer(context))
    const boundaryDistance = resolveNativeNavigationDistance(match.blockIndex, loadedBlockRange)
    if (boundaryDistance < NATIVE_NAVIGATION_DISTANCE_THRESHOLD && pendingNavigationRetryCount <= 1) {
      debugLog('pending-navigation:native-skip', {
        attempt: pendingNavigationRetryCount,
        boundaryDistance,
        loadedBlockRange,
        matchId: match.id,
        reason: 'distance-too-small',
      })
      return false
    }

    nativeNavigationAttemptedMatchId = match.id
    nativeNavigationWaitDeadline = Date.now() + NATIVE_NAVIGATION_WAIT_MS
    debugLog('pending-navigation:native-trigger', {
      attempt: pendingNavigationRetryCount,
      boundaryDistance,
      blockId: match.blockId,
      loadedBlockRange,
      matchId: match.id,
      waitMs: NATIVE_NAVIGATION_WAIT_MS,
    })
    void triggerNativeMatchNavigation(match)
      .then((result) => {
        if (pendingNavigationMatchId !== match.id) {
          return
        }

        if (result === 'triggered') {
          return
        }

        nativeNavigationWaitDeadline = 0
        debugLog('pending-navigation:native-fail', {
          matchId: match.id,
          result,
        })
      })
      .catch((error) => {
        // 触发链路自身的异常不应成为 unhandled rejection
        nativeNavigationWaitDeadline = 0
        debugLog('pending-navigation:native-trigger-error', {
          error: error instanceof Error ? error.message : String(error),
          matchId: match.id,
        })
      })

    return true
  }

  function isWaitingForNativeNavigation(matchId: string) {
    return nativeNavigationAttemptedMatchId === matchId
      && nativeNavigationWaitDeadline > Date.now()
  }

  function schedulePendingNavigationRetry() {
    window.clearTimeout(pendingNavigationTimer)
    pendingNavigationTimer = window.setTimeout(() => {
      retryPendingNavigation()
    }, 120)
  }

  function attemptExpandCollapsedAncestors(match: SearchMatch) {
    const collapsedAncestorIds = (match.collapsedAncestorIds ?? []).filter((ancestorId) => {
      return ancestorId.trim().length > 0 && !attemptedCollapsedAncestorIds.has(ancestorId)
    })

    if (!collapsedAncestorIds.length) {
      return false
    }

    collapsedAncestorIds.forEach((ancestorId) => attemptedCollapsedAncestorIds.add(ancestorId))
    debugLog('pending-navigation:unfold-collapsed-ancestors', {
      ancestorIds: collapsedAncestorIds,
      matchId: match.id,
    })

    const unfoldPromise = Promise.all(collapsedAncestorIds.map(async (ancestorId) => {
      try {
        await unfoldBlock(ancestorId)
      } catch (error) {
        debugLog('pending-navigation:unfold-collapsed-ancestor-failed', {
          ancestorId,
          error: error instanceof Error ? error.message : String(error),
          matchId: match.id,
        })
      }
    }))

    // unfold 请求可能永不返回（内核无响应）：以超时兜底继续重试，避免导航提示卡死
    void Promise.race([
      unfoldPromise,
      new Promise<void>((resolve) => window.setTimeout(resolve, UNFOLD_SETTLE_TIMEOUT_MS)),
    ]).finally(() => {
      if (pendingNavigationMatchId !== match.id) {
        return
      }

      schedulePendingNavigationRetry()
    })

    return true
  }

}
