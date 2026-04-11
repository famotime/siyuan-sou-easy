import type {
  EditorContext,
  ScrollMatchResult,
  SearchMatch,
} from '../types'
import { resolveEditorSearchRoot } from '../editor/blocks'
import { resolveEditorScrollContainer } from '../editor/scroll-container'
import { debugElement, debugLog } from '../debug'
import { unfoldBlock } from '../kernel'
import {
  canTriggerNativeMatchNavigation,
  triggerNativeMatchNavigation,
} from '../native-navigation'
import { t } from '@/i18n/runtime'
import {
  advanceApproximateNavigationProgress,
  createApproximateNavigationProgress,
  createDirectNavigationProgress,
  resetApproximateNavigationProgress,
  resetDirectNavigationProgress,
  resolveApproximateNavigationTimeoutReason,
  resolveDirectNavigationAction,
  type ApproximateNavigationProgress,
  type DirectNavigationProgress,
} from './search-pending-navigation-state'
import type { SearchReplaceState } from './state'

interface LoadedBlockRange {
  loadedIndexes: number[]
  max: number
  min: number
  source: 'all' | 'visible-segment'
  visibleIndexes: number[]
}

interface ApproximateScrollState {
  clientHeight: number
  loadedBlockRange: LoadedBlockRange | null
  maxScrollTop: number
  nextScrollTop: number
  previousScrollTop: number
  scrollContainer: HTMLElement
  scrollHeight: number
}

interface ApproximateScrollApplication {
  appliedScrollTop: number
  appliedWith: 'scroll-to' | 'scroll-top'
  nudgedBoundary: 'lower' | 'upper' | null
}

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

  let approximateNavigationProgress: ApproximateNavigationProgress = createApproximateNavigationProgress()
  let pendingNavigationTimer = 0
  let pendingNavigationRetryCount = 0
  let pendingNavigationMatchId = ''
  let attemptedCollapsedAncestorIds = new Set<string>()
  let directNavigationProgress: DirectNavigationProgress<EditorContext['protyleRef']> = createDirectNavigationProgress()
  let nativeNavigationAttemptedMatchId = ''
  let nativeNavigationWaitDeadline = 0

  function beginPendingNavigation(match: SearchMatch) {
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

    const approximateNavigationState = scrollApproximateMatchIntoView(context, currentMatch)
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
    const boundaryDistance = resolveNativeNavigationDistance(match, loadedBlockRange)
    if (boundaryDistance < NATIVE_NAVIGATION_DISTANCE_THRESHOLD) {
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
    void triggerNativeMatchNavigation(match).then((result) => {
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

    collapsedAncestorIds.forEach(ancestorId => attemptedCollapsedAncestorIds.add(ancestorId))
    debugLog('pending-navigation:unfold-collapsed-ancestors', {
      ancestorIds: collapsedAncestorIds,
      matchId: match.id,
    })

    void Promise.all(collapsedAncestorIds.map(async (ancestorId) => {
      try {
        await unfoldBlock(ancestorId)
      } catch (error) {
        debugLog('pending-navigation:unfold-collapsed-ancestor-failed', {
          ancestorId,
          error: error instanceof Error ? error.message : String(error),
          matchId: match.id,
        })
      }
    })).finally(() => {
      if (pendingNavigationMatchId !== match.id) {
        return
      }

      window.clearTimeout(pendingNavigationTimer)
      pendingNavigationTimer = window.setTimeout(() => {
        retryPendingNavigation()
      }, 120)
    })

    return true
  }

  function scrollApproximateMatchIntoView(context: EditorContext, match: SearchMatch) {
    const scrollContainers = resolveApproximateScrollContainers(context)
    if (!scrollContainers.length || state.searchableBlockCount <= 0) {
      return null
    }

    let activeState = resolveApproximateScrollState(context, match, scrollContainers[0]!)
    if (!activeState) {
      return null
    }

    let activeScrollApplication = applyApproximateScroll(activeState)
    let appliedScrollTop = activeScrollApplication.appliedScrollTop
    if (
      Math.abs(activeState.nextScrollTop - activeState.previousScrollTop) > 1
      && Math.abs(appliedScrollTop - activeState.nextScrollTop) > 1
    ) {
      for (const candidate of scrollContainers.slice(1)) {
        const fallbackState = resolveApproximateScrollState(context, match, candidate)
        if (!fallbackState) {
          continue
        }

        const fallbackScrollApplication = applyApproximateScroll(fallbackState)
        const fallbackAppliedScrollTop = fallbackScrollApplication.appliedScrollTop
        if (Math.abs(fallbackAppliedScrollTop - fallbackState.nextScrollTop) <= 1) {
          activeState = fallbackState
          activeScrollApplication = fallbackScrollApplication
          appliedScrollTop = fallbackAppliedScrollTop
          break
        }
      }
    }

    debugLog('pending-navigation:approximate-scroll', {
      attempt: pendingNavigationRetryCount,
      blockIndex: match.blockIndex,
      clientHeight: activeState.clientHeight,
      container: debugElement(activeState.scrollContainer),
      currentScrollTop: activeState.previousScrollTop,
      loadedBlockRange: activeState.loadedBlockRange,
      matchId: match.id,
      maxScrollTop: activeState.maxScrollTop,
      nextScrollTop: activeState.nextScrollTop,
      appliedWith: activeScrollApplication.appliedWith,
      nudgedBoundary: activeScrollApplication.nudgedBoundary,
      scrollHeight: activeState.scrollHeight,
      appliedScrollTop,
    })

    return {
      key: [
        activeState.loadedBlockRange?.min ?? -1,
        activeState.loadedBlockRange?.max ?? -1,
        activeState.nextScrollTop,
        activeState.scrollHeight,
        activeState.scrollContainer.className,
      ].join(':'),
      waitingAtLowerBoundary: Boolean(
        activeState.loadedBlockRange
        && match.blockIndex > activeState.loadedBlockRange.max
        && activeState.nextScrollTop >= (activeState.maxScrollTop - 1)
        && (match.blockIndex - activeState.loadedBlockRange.max) >= 20
      ),
      waitingAtUpperBoundary: Boolean(
        activeState.loadedBlockRange
        && match.blockIndex < activeState.loadedBlockRange.min
        && activeState.nextScrollTop <= 1,
      ),
    }
  }

  function resolveApproximateScrollState(
    context: EditorContext,
    match: SearchMatch,
    scrollContainer: HTMLElement,
  ): ApproximateScrollState | null {
    const scrollHeight = Math.max(scrollContainer.scrollHeight || 0, scrollContainer.clientHeight || 0, 1)
    const clientHeight = Math.max(scrollContainer.clientHeight || 0, 1)
    const maxScrollTop = Math.max(0, scrollHeight - clientHeight)
    const loadedBlockRange = resolveLoadedBlockRange(context, scrollContainer)
    const previousScrollTop = scrollContainer.scrollTop || 0
    const nextScrollTop = resolveApproximateScrollTop(match, {
      clientHeight,
      loadedBlockRange,
      maxScrollTop,
      scrollHeight,
    })

    return {
      clientHeight,
      loadedBlockRange,
      maxScrollTop,
      nextScrollTop,
      previousScrollTop,
      scrollContainer,
      scrollHeight,
    }
  }

  function applyApproximateScroll(state: ApproximateScrollState): ApproximateScrollApplication {
    if (typeof state.scrollContainer.scrollTo === 'function') {
      state.scrollContainer.scrollTo({
        behavior: 'auto',
        top: state.nextScrollTop,
      })
      const scrolledWithScrollTo = state.scrollContainer.scrollTop || 0
      if (Math.abs(scrolledWithScrollTo - state.nextScrollTop) <= 1) {
        const nudgedBoundary = nudgeApproximateBoundaryIfNeeded(state, scrolledWithScrollTo)
        return {
          appliedScrollTop: scrolledWithScrollTo,
          appliedWith: 'scroll-to',
          nudgedBoundary,
        }
      }
    }

    state.scrollContainer.scrollTop = state.nextScrollTop
    const scrolledWithScrollTop = state.scrollContainer.scrollTop || 0
    const nudgedBoundary = nudgeApproximateBoundaryIfNeeded(state, scrolledWithScrollTop)
    return {
      appliedScrollTop: scrolledWithScrollTop,
      appliedWith: 'scroll-top',
      nudgedBoundary,
    }
  }

  function nudgeApproximateBoundaryIfNeeded(
    state: ApproximateScrollState,
    appliedScrollTop: number,
  ): 'lower' | 'upper' | null {
    if (state.maxScrollTop <= 1) {
      return null
    }

    if (state.nextScrollTop <= 1 && state.previousScrollTop <= 1) {
      triggerBoundaryNudge(state.scrollContainer, 1, 0, 'up')
      return 'upper'
    }

    if (
      state.nextScrollTop >= (state.maxScrollTop - 1)
      && appliedScrollTop >= (state.maxScrollTop - 1)
    ) {
      triggerBoundaryNudge(
        state.scrollContainer,
        Math.max(0, state.maxScrollTop - 1),
        state.maxScrollTop,
        'down',
      )
      return 'lower'
    }

    return null
  }

  function triggerBoundaryNudge(
    scrollContainer: HTMLElement,
    awayFromBoundary: number,
    boundaryScrollTop: number,
    direction: 'up' | 'down',
  ) {
    if (Math.abs(awayFromBoundary - boundaryScrollTop) <= 0.5) {
      return
    }

    scrollContainer.scrollTop = awayFromBoundary
    dispatchBoundaryScrollEvent(scrollContainer, direction)
    scrollContainer.scrollTop = boundaryScrollTop
    dispatchBoundaryScrollEvent(scrollContainer, direction)
  }

  function dispatchBoundaryScrollEvent(scrollContainer: HTMLElement, direction: 'up' | 'down') {
    scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }))

    const WheelEventConstructor = scrollContainer.ownerDocument.defaultView?.WheelEvent
      ?? globalThis.WheelEvent
    if (typeof WheelEventConstructor !== 'function') {
      return
    }

    scrollContainer.dispatchEvent(new WheelEventConstructor('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: direction === 'down' ? 120 : -120,
    }))
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
      loadedBlockRange: LoadedBlockRange | null
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

  function resolveLoadedBlockRange(context: EditorContext, scrollContainer?: HTMLElement | null): LoadedBlockRange | null {
    const blockIndexById = new Map(state.minimapBlocks.map(block => [block.blockId, block.blockIndex]))
    if (!blockIndexById.size) {
      return null
    }

    const searchRoot = resolveEditorSearchRoot(context, scrollContainer ?? null)
    const loadedElements = Array.from(
      searchRoot.querySelectorAll<HTMLElement>('[data-node-id][data-type]'),
    )
    const loadedEntries = loadedElements
      .map((element) => {
        const blockId = element.dataset.nodeId
        const blockIndex = blockId ? blockIndexById.get(blockId) : undefined
        if (typeof blockIndex !== 'number') {
          return null
        }

        return {
          blockIndex,
          element,
        }
      })
      .filter((entry): entry is { blockIndex: number, element: HTMLElement } => Boolean(entry))

    if (!loadedEntries.length) {
      return null
    }

    const containerRect = scrollContainer?.getBoundingClientRect()
    const hasViewport = Boolean(containerRect && containerRect.bottom > containerRect.top)
    const loadedIndexes = loadedEntries.map(({ blockIndex }) => blockIndex)
    if (hasViewport && containerRect) {
      const visibleEntries = loadedEntries
        .filter(({ element }) => {
          const rect = element.getBoundingClientRect()
          return rect.bottom > containerRect.top && rect.top < containerRect.bottom
        })
      const visibleIndexes = visibleEntries.map(({ blockIndex }) => blockIndex)

      if (visibleIndexes.length) {
        const centeredVisibleSegment = resolveCenteredVisibleSegment(visibleEntries, containerRect)
        return {
          loadedIndexes,
          max: centeredVisibleSegment.max,
          min: centeredVisibleSegment.min,
          source: 'visible-segment' as const,
          visibleIndexes: centeredVisibleSegment.indexes,
        }
      }
    }

    return {
      loadedIndexes,
      max: Math.max(...loadedIndexes),
      min: Math.min(...loadedIndexes),
      source: 'all' as const,
      visibleIndexes: [],
    }
  }

  function resolveApproximateScrollContainers(context: EditorContext) {
    const containers: HTMLElement[] = []
    const primaryContainer = resolveEditorScrollContainer(context)
    const deferPrimaryContainer = isTransitionScrollContainer(primaryContainer)
    if (primaryContainer && !deferPrimaryContainer) {
      containers.push(primaryContainer)
    }

    let current = primaryContainer?.parentElement ?? context.protyle.parentElement
    while (current) {
      if (isVerticallyScrollable(current) && !containers.includes(current)) {
        containers.push(current)
      }
      current = current.parentElement
    }

    const scrollingElement = document.scrollingElement
    if (
      scrollingElement instanceof HTMLElement
      && scrollingElement.contains(context.protyle)
      && isVerticallyScrollable(scrollingElement)
      && !containers.includes(scrollingElement)
    ) {
      containers.push(scrollingElement)
    }

    if (primaryContainer && deferPrimaryContainer && !containers.includes(primaryContainer)) {
      containers.push(primaryContainer)
    }

    return containers
  }

  function resolveCenteredVisibleSegment(
    visibleEntries: Array<{ blockIndex: number, element: HTMLElement }>,
    containerRect: DOMRect | DOMRectReadOnly,
  ) {
    const sortedEntries = visibleEntries
      .slice()
      .sort((left, right) => left.blockIndex - right.blockIndex)
    const segments: Array<{
      entries: Array<{ blockIndex: number, element: HTMLElement }>
      indexes: number[]
      max: number
      min: number
    }> = []

    sortedEntries.forEach((entry) => {
      const previousSegment = segments[segments.length - 1]
      const previousEntry = previousSegment?.entries[previousSegment.entries.length - 1]
      if (!previousSegment || !previousEntry || entry.blockIndex !== previousEntry.blockIndex + 1) {
        segments.push({
          entries: [entry],
          indexes: [entry.blockIndex],
          max: entry.blockIndex,
          min: entry.blockIndex,
        })
        return
      }

      previousSegment.entries.push(entry)
      previousSegment.indexes.push(entry.blockIndex)
      previousSegment.max = entry.blockIndex
    })

    const containerCenter = (containerRect.top + containerRect.bottom) / 2
    return segments
      .slice()
      .sort((left, right) => {
        const leftDistance = resolveSegmentViewportDistance(left.entries, containerCenter)
        const rightDistance = resolveSegmentViewportDistance(right.entries, containerCenter)
        if (leftDistance !== rightDistance) {
          return leftDistance - rightDistance
        }

        return left.min - right.min
      })[0]!
  }

  function resolveSegmentViewportDistance(
    entries: Array<{ blockIndex: number, element: HTMLElement }>,
    containerCenter: number,
  ) {
    return Math.min(
      ...entries.map(({ element }) => {
        const rect = element.getBoundingClientRect()
        const elementCenter = (rect.top + rect.bottom) / 2
        return Math.abs(elementCenter - containerCenter)
      }),
    )
  }

  function isVerticallyScrollable(element: HTMLElement) {
    if ((element.scrollHeight || 0) <= (element.clientHeight || 0)) {
      return false
    }

    const style = globalThis.getComputedStyle?.(element)
    const overflowY = style?.overflowY || element.style.overflowY || element.style.overflow || ''
    return /auto|scroll|overlay|hidden/.test(overflowY)
  }

  function isTransitionScrollContainer(element: HTMLElement | null | undefined) {
    return element?.classList.contains('protyle-content--transition') ?? false
  }
}

function resolveNativeNavigationDistance(match: SearchMatch, loadedBlockRange: LoadedBlockRange | null) {
  if (!loadedBlockRange) {
    return 0
  }

  if (match.blockIndex < loadedBlockRange.min) {
    return loadedBlockRange.min - match.blockIndex
  }

  if (match.blockIndex > loadedBlockRange.max) {
    return match.blockIndex - loadedBlockRange.max
  }

  return 0
}

function serializeLoadedBlockRange(loadedBlockRange: LoadedBlockRange | null) {
  if (!loadedBlockRange) {
    return 'missing'
  }

  return [
    loadedBlockRange.min,
    loadedBlockRange.max,
    loadedBlockRange.loadedIndexes.length,
    loadedBlockRange.source,
  ].join(':')
}
