import type { EditorContext } from '../types'
import type { SearchReplaceState } from './state'
import { resolveEditorSearchRoot } from '../editor/blocks'
import { resolveEditorScrollContainer } from '../editor/scroll-container'
import { createBlockIndexByIdMap } from './minimap-blocks'

// 拆分自 search-pending-navigation.ts（RF-104）：loadedBlockRange 的解析、缓存与
// 相关纯函数。原实现与注释保持不变，仅将闭包依赖显式化为参数。

export interface LoadedBlockRange {
  loadedIndexes: number[]
  max: number
  min: number
  source: 'all' | 'visible-segment'
  visibleIndexes: number[]
}

/**
 * 单轮重试内的 loadedBlockRange 缓存（key 为滚动容器，null 表示未解析到容器）。
 * 同一轮内、applyApproximateScroll 首次执行之前，minimapBlocks、搜索根 DOM 与滚动位置
 * 均不会合法变化（轮内无 await、无派发事件、updateIndex/原生导航触发后立即结束本轮），
 * 因此直接导航判定、原生导航距离与首个近似滚动容器对同一容器的重复全量扫描可安全复用。
 * 生命周期：每轮 retryPendingNavigation 入口清空；applyApproximateScroll 改动滚动位置后
 * 整体清空（视口相对矩形随滚动变化，后续候选容器必须重新解析）。
 */
export function createLoadedBlockRangeResolver(
  state: Pick<SearchReplaceState, 'minimapBlocks'>,
) {
  const cache = new Map<HTMLElement | null, LoadedBlockRange | null>()

  function resolveLoadedBlockRange(
    context: EditorContext,
    scrollContainer?: HTMLElement | null,
  ): LoadedBlockRange | null {
    const cacheKey = scrollContainer ?? null
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey) ?? null
    }

    const loadedBlockRange = computeLoadedBlockRange(state, context, scrollContainer)
    cache.set(cacheKey, loadedBlockRange)
    return loadedBlockRange
  }

  function clearLoadedBlockRangeCache() {
    cache.clear()
  }

  return {
    clearLoadedBlockRangeCache,
    resolveLoadedBlockRange,
  }
}

export function computeLoadedBlockRange(
  state: Pick<SearchReplaceState, 'minimapBlocks'>,
  context: EditorContext,
  scrollContainer?: HTMLElement | null,
): LoadedBlockRange | null {
  const blockIndexById = createBlockIndexByIdMap(state.minimapBlocks)
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

export function resolveApproximateScrollContainers(context: EditorContext) {
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

export function resolveCenteredVisibleSegment(
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

export function resolveSegmentViewportDistance(
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

export function isVerticallyScrollable(element: HTMLElement) {
  if ((element.scrollHeight || 0) <= (element.clientHeight || 0)) {
    return false
  }

  const style = globalThis.getComputedStyle?.(element)
  const overflowY = style?.overflowY || element.style.overflowY || element.style.overflow || ''
  return /auto|scroll|overlay|hidden/.test(overflowY)
}

export function isTransitionScrollContainer(element: HTMLElement | null | undefined) {
  return element?.classList.contains('protyle-content--transition') ?? false
}

export function resolveNativeNavigationDistance(matchBlockIndex: number, loadedBlockRange: LoadedBlockRange | null) {
  if (!loadedBlockRange) {
    return 0
  }

  if (matchBlockIndex < loadedBlockRange.min) {
    return loadedBlockRange.min - matchBlockIndex
  }

  if (matchBlockIndex > loadedBlockRange.max) {
    return matchBlockIndex - loadedBlockRange.max
  }

  return 0
}

export function serializeLoadedBlockRange(loadedBlockRange: LoadedBlockRange | null) {
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
