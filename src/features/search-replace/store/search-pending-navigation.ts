import type {
  EditorContext,
  ScrollMatchResult,
  SearchMatch,
} from '../types'
import { resolveEditorSearchRoot } from '../editor/blocks'
import { resolveEditorScrollContainer } from '../editor/scroll-container'
import { debugElement, debugLog } from '../debug'
import { t } from '@/i18n/runtime'
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
  let pendingNavigationLowerBoundaryAttempts = 0
  let pendingNavigationTimer = 0
  let pendingNavigationUpperBoundaryAttempts = 0
  let pendingNavigationStalledAttempts = 0
  let pendingNavigationRetryCount = 0
  let pendingNavigationMatchId = ''
  let previousApproximateNavigationKey = ''

  function beginPendingNavigation(match: SearchMatch) {
    pendingNavigationLowerBoundaryAttempts = 0
    pendingNavigationMatchId = match.id
    pendingNavigationUpperBoundaryAttempts = 0
    pendingNavigationStalledAttempts = 0
    pendingNavigationRetryCount = 0
    previousApproximateNavigationKey = ''
    state.navigationHint = t('navigationPending')
    debugLog('pending-navigation:begin', {
      blockId: match.blockId,
      blockIndex: match.blockIndex,
      matchId: match.id,
    })
  }

  function clearPendingNavigation(reason = 'reset') {
    window.clearTimeout(pendingNavigationTimer)
    pendingNavigationLowerBoundaryAttempts = 0
    pendingNavigationTimer = 0
    pendingNavigationUpperBoundaryAttempts = 0
    pendingNavigationStalledAttempts = 0
    pendingNavigationRetryCount = 0
    pendingNavigationMatchId = ''
    previousApproximateNavigationKey = ''
    state.navigationHint = ''
    debugLog('pending-navigation:clear', {
      reason,
    })
  }

  function retryPendingNavigation() {
    const currentMatch = getCurrentMatch()
    const context = resolveEditorContext()
    if (!state.visible || !context || !currentMatch || currentMatch.id !== pendingNavigationMatchId) {
      clearPendingNavigation('context-mismatch')
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

    const approximateNavigationState = scrollApproximateMatchIntoView(context, currentMatch)
    if (!approximateNavigationState) {
      clearPendingNavigation('approximate-unavailable')
      return
    }

    const { key, waitingAtLowerBoundary, waitingAtUpperBoundary } = approximateNavigationState
    if (key !== previousApproximateNavigationKey) {
      pendingNavigationStalledAttempts = 1
      pendingNavigationLowerBoundaryAttempts = waitingAtLowerBoundary ? 1 : 0
      pendingNavigationUpperBoundaryAttempts = waitingAtUpperBoundary ? 1 : 0
      previousApproximateNavigationKey = key
    } else if (waitingAtLowerBoundary) {
      pendingNavigationLowerBoundaryAttempts += 1
    } else if (waitingAtUpperBoundary) {
      pendingNavigationUpperBoundaryAttempts += 1
    } else {
      pendingNavigationStalledAttempts += 1
    }

    if (
      pendingNavigationLowerBoundaryAttempts >= 200
      || pendingNavigationUpperBoundaryAttempts >= 200
      || pendingNavigationStalledAttempts >= 40
    ) {
      clearPendingNavigation(
        pendingNavigationLowerBoundaryAttempts >= 200
          ? 'lower-boundary-timeout'
          : pendingNavigationUpperBoundaryAttempts >= 200
            ? 'upper-boundary-timeout'
            : 'stalled-timeout',
      )
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
    if (Math.abs(appliedScrollTop - state.previousScrollTop) > 1 || state.maxScrollTop <= 1) {
      return null
    }

    if (state.nextScrollTop <= 1 && state.previousScrollTop <= 1) {
      triggerBoundaryNudge(state.scrollContainer, 1, 0)
      return 'upper'
    }

    if (
      state.nextScrollTop >= (state.maxScrollTop - 1)
      && state.previousScrollTop >= (state.maxScrollTop - 1)
    ) {
      triggerBoundaryNudge(
        state.scrollContainer,
        Math.max(0, state.maxScrollTop - 1),
        state.maxScrollTop,
      )
      return 'lower'
    }

    return null
  }

  function triggerBoundaryNudge(
    scrollContainer: HTMLElement,
    awayFromBoundary: number,
    boundaryScrollTop: number,
  ) {
    if (Math.abs(awayFromBoundary - boundaryScrollTop) <= 0.5) {
      return
    }

    scrollContainer.scrollTop = awayFromBoundary
    dispatchBoundaryScrollEvent(scrollContainer)
    scrollContainer.scrollTop = boundaryScrollTop
    dispatchBoundaryScrollEvent(scrollContainer)
  }

  function dispatchBoundaryScrollEvent(scrollContainer: HTMLElement) {
    scrollContainer.dispatchEvent(new Event('scroll'))
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

  function resolveLoadedBlockRange(context: EditorContext, scrollContainer?: HTMLElement | null) {
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
          source: 'visible-segment',
          visibleIndexes: centeredVisibleSegment.indexes,
        }
      }
    }

    return {
      loadedIndexes,
      max: Math.max(...loadedIndexes),
      min: Math.min(...loadedIndexes),
      source: 'all',
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
