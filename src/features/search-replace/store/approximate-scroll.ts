import type {
  EditorContext,
  SearchMatch,
} from '../types'
import type { LoadedBlockRange } from './loaded-block-range'
import {
  debugElement,
  debugLogLazy,
} from '../debug'
import { resolveApproximateScrollContainers } from './loaded-block-range'

// 拆分自 search-pending-navigation.ts（RF-104）：近似滚动引擎。
// 原实现与注释保持不变，仅将闭包依赖显式化为参数。

export interface ApproximateScrollState {
  clientHeight: number
  loadedBlockRange: LoadedBlockRange | null
  maxScrollTop: number
  nextScrollTop: number
  previousScrollTop: number
  scrollContainer: HTMLElement
  scrollHeight: number
}

export interface ApproximateScrollApplication {
  appliedScrollTop: number
  appliedWith: 'scroll-to' | 'scroll-top'
  nudgedBoundary: 'lower' | 'upper' | null
}

export interface ApproximateScrollOutcome {
  key: string
  waitingAtLowerBoundary: boolean
  waitingAtUpperBoundary: boolean
}

export interface ApproximateScrollControllerDeps {
  /** 当前重试轮次（仅用于调试日志） */
  getAttempt: () => number
  getSearchableBlockCount: () => number
  /** applyApproximateScroll 改动滚动位置后清空 loadedBlockRange 缓存 */
  onScrollApplied: () => void
  resolveLoadedBlockRange: (
    context: EditorContext,
    scrollContainer?: HTMLElement | null,
  ) => LoadedBlockRange | null
}

export function scrollApproximateMatchIntoView(
  deps: ApproximateScrollControllerDeps,
  context: EditorContext,
  match: SearchMatch,
): ApproximateScrollOutcome | null {
  const scrollContainers = resolveApproximateScrollContainers(context)
  const searchableBlockCount = deps.getSearchableBlockCount()
  if (!scrollContainers.length || searchableBlockCount <= 0) {
    return null
  }

  let activeState = resolveApproximateScrollState(deps, context, match, scrollContainers[0]!)
  if (!activeState) {
    return null
  }

  let activeScrollApplication = applyApproximateScroll(deps, activeState)
  let appliedScrollTop = activeScrollApplication.appliedScrollTop
  if (
    Math.abs(activeState.nextScrollTop - activeState.previousScrollTop) > 1
    && Math.abs(appliedScrollTop - activeState.nextScrollTop) > 1
  ) {
    for (const candidate of scrollContainers.slice(1)) {
      const fallbackState = resolveApproximateScrollState(deps, context, match, candidate)
      if (!fallbackState) {
        continue
      }

      const fallbackScrollApplication = applyApproximateScroll(deps, fallbackState)
      const fallbackAppliedScrollTop = fallbackScrollApplication.appliedScrollTop
      if (Math.abs(fallbackAppliedScrollTop - fallbackState.nextScrollTop) <= 1) {
        activeState = fallbackState
        activeScrollApplication = fallbackScrollApplication
        appliedScrollTop = fallbackAppliedScrollTop
        break
      }
    }
  }

  debugLogLazy('pending-navigation:approximate-scroll', () => ({
    attempt: deps.getAttempt(),
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
  }))

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
      && (match.blockIndex - activeState.loadedBlockRange.max) >= 20,
    ),
    waitingAtUpperBoundary: Boolean(
      activeState.loadedBlockRange
      && match.blockIndex < activeState.loadedBlockRange.min
      && activeState.nextScrollTop <= 1,
    ),
  }
}

function resolveApproximateScrollState(
  deps: ApproximateScrollControllerDeps,
  context: EditorContext,
  match: SearchMatch,
  scrollContainer: HTMLElement,
): ApproximateScrollState | null {
  const scrollHeight = Math.max(scrollContainer.scrollHeight || 0, scrollContainer.clientHeight || 0, 1)
  const clientHeight = Math.max(scrollContainer.clientHeight || 0, 1)
  const maxScrollTop = Math.max(0, scrollHeight - clientHeight)
  const loadedBlockRange = deps.resolveLoadedBlockRange(context, scrollContainer)
  const previousScrollTop = scrollContainer.scrollTop || 0
  const nextScrollTop = resolveApproximateScrollTop(match.blockIndex, deps.getSearchableBlockCount(), {
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

function applyApproximateScroll(
  deps: ApproximateScrollControllerDeps,
  state: ApproximateScrollState,
): ApproximateScrollApplication {
  const application = computeApproximateScrollApplication(state)
  // 本轮内唯一改动滚动位置/DOM 的入口（含边界 nudge 及其同步派发的 scroll/wheel 事件）。
  // 滚动会改变所有内容的视口相对矩形，更早缓存的 loadedBlockRange 一律作废，
  // 后续候选容器（含 defer 场景下被推迟的主容器）必须重新解析。
  deps.onScrollApplied()
  return application
}

function computeApproximateScrollApplication(state: ApproximateScrollState): ApproximateScrollApplication {
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

export function resolveApproximateScrollTop(
  blockIndex: number,
  searchableBlockCount: number,
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
    if (blockIndex > loadedBlockRange.max) {
      return maxScrollTop
    }

    if (blockIndex < loadedBlockRange.min) {
      return 0
    }
  }

  const ratio = (blockIndex + 0.5) / searchableBlockCount
  return Math.max(
    0,
    Math.min(
      maxScrollTop,
      (ratio * scrollHeight) - (clientHeight / 2),
    ),
  )
}
