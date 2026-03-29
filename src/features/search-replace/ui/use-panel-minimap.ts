import {
  computed,
  onBeforeUnmount,
  ref,
  watch,
  type ComputedRef,
} from 'vue'
import {
  findEditorContextByRootId,
  getActiveEditorContext,
  getUniqueBlockElements,
} from '@/features/search-replace/editor'
import type { SearchReplaceState } from '../store/state'
import type {
  EditorContext,
  SearchMatch,
} from '../types'
import {
  MINIMAP_GAP,
  MINIMAP_MARKER_MIN_HEIGHT,
  MINIMAP_MAX_HEIGHT,
  MINIMAP_MIN_HEIGHT,
  MINIMAP_WIDTH,
  PANEL_MARGIN,
  buildMinimapDocLines,
  clamp,
  computeMinimapViewport,
  createMinimapScrollTarget,
  projectIndexedMinimapDocBlock,
  projectIndexedMinimapMarker,
  resolveMinimapDocVariant,
  shouldReleaseMinimapScrollTarget,
  syncMinimapScrollTarget,
  type MinimapDocBlock,
  type MinimapLayout,
  type MinimapMarker,
  type MinimapScrollTarget,
} from './minimap-layout'

interface UsePanelMinimapOptions {
  currentMatch: ComputedRef<SearchMatch | null>
  state: Pick<SearchReplaceState, 'currentIndex' | 'currentRootId' | 'currentTitle' | 'matches' | 'minimapBlocks' | 'minimapVisible' | 'searchableBlockCount' | 'visible'>
}

export function usePanelMinimap({
  currentMatch,
  state,
}: UsePanelMinimapOptions) {
  const minimapRef = ref<HTMLDivElement>()
  const minimapState = ref<MinimapLayout | null>(null)
  let minimapScrollContainer: HTMLElement | null = null
  let minimapScrollTarget: MinimapScrollTarget | null = null

  const minimapStyle = computed(() => {
    if (!minimapState.value) {
      return undefined
    }

    return {
      height: `${minimapState.value.height}px`,
      right: `${minimapState.value.right}px`,
      top: `${minimapState.value.top}px`,
      width: `${MINIMAP_WIDTH}px`,
    }
  })

  watch(
    () => [
      state.visible,
      state.minimapVisible,
      state.currentRootId,
      state.currentTitle,
      state.currentIndex,
      state.minimapBlocks.map(block => block.blockId).join('|'),
      state.searchableBlockCount,
      state.matches.map(match => match.id).join('|'),
    ],
    () => {
      refreshMinimap()
    },
  )

  window.addEventListener('resize', handleViewportResize)

  onBeforeUnmount(() => {
    clearMinimap()
    window.removeEventListener('resize', handleViewportResize)
  })

  return {
    clearMinimap,
    minimapRef,
    minimapState,
    minimapStyle,
    onMinimapTrackClick,
    refreshMinimap,
  }

  function clearMinimap() {
    minimapState.value = null
    minimapScrollTarget = null
    syncMinimapScrollContainer(null)
  }

  function handleMinimapScroll() {
    if (
      minimapScrollContainer
      && shouldReleaseMinimapScrollTarget(
        minimapScrollTarget,
        minimapScrollContainer.scrollTop || 0,
        minimapScrollContainer.scrollHeight || 0,
        minimapScrollContainer.clientHeight || 0,
      )
    ) {
      minimapScrollTarget = null
    }

    refreshMinimap()
  }

  function handleViewportResize() {
    refreshMinimap()
  }

  function refreshMinimap() {
    if (!state.visible || !state.minimapVisible) {
      clearMinimap()
      return
    }

    const context = resolveMinimapContext()
    if (!context) {
      clearMinimap()
      return
    }

    const scrollContainer = resolveMinimapScrollContainer(context)
    const scrollRect = scrollContainer.getBoundingClientRect()
    if (scrollRect.height <= 0) {
      clearMinimap()
      return
    }

    const scrollHeight = Math.max(scrollContainer.scrollHeight || 0, scrollRect.height, 1)
    const clientHeight = Math.max(scrollContainer.clientHeight || scrollRect.height, 1)
    const nextScrollTarget = syncMinimapScrollTarget(minimapScrollTarget, scrollHeight, clientHeight)
    if (nextScrollTarget && nextScrollTarget !== minimapScrollTarget) {
      minimapScrollTarget = nextScrollTarget
      scrollTo(scrollContainer, nextScrollTarget.expectedScrollTop)
    }

    const height = clamp(scrollRect.height - 16, MINIMAP_MIN_HEIGHT, MINIMAP_MAX_HEIGHT)
    const scrollTop = clamp(scrollContainer.scrollTop || 0, 0, Math.max(0, scrollHeight - clientHeight))
    const indexedViewport = projectIndexedViewport(context, scrollRect, height)
    const { viewportHeight, viewportTop } = computeMinimapViewport({
      clientHeight,
      height,
      indexedViewport,
      scrollHeight,
      scrollTarget: minimapScrollTarget,
      scrollTop,
    })

    minimapState.value = {
      blocks: collectMinimapDocBlocks(context, scrollContainer, scrollRect, scrollHeight, height),
      clientHeight,
      height,
      markers: state.matches
        .map((match) => {
          const marker = projectIndexedMinimapMarker(height, match, state.searchableBlockCount)
          if (!marker) {
            return null
          }

          return {
            ...marker,
            current: currentMatch.value?.id === match.id,
          }
        })
        .filter(Boolean) as MinimapMarker[],
      right: Math.max(PANEL_MARGIN, window.innerWidth - scrollRect.right + MINIMAP_GAP),
      scrollHeight,
      top: clamp(scrollRect.top, PANEL_MARGIN, Math.max(PANEL_MARGIN, window.innerHeight - height - PANEL_MARGIN)),
      viewportHeight,
      viewportTop,
    }
    syncMinimapScrollContainer(scrollContainer)
  }

  function onMinimapTrackClick(event: MouseEvent) {
    if (!minimapState.value || !minimapScrollContainer) {
      return
    }

    const track = event.currentTarget instanceof HTMLElement
      ? event.currentTarget
      : minimapRef.value?.querySelector<HTMLElement>('.sfsr-minimap__track')
    if (!track) {
      return
    }

    const rect = track.getBoundingClientRect()
    const trackHeight = rect.height > 0 ? rect.height : minimapState.value.height
    const trackTop = rect.height > 0 ? rect.top : minimapState.value.top
    minimapScrollTarget = createMinimapScrollTarget({
      clientHeight: minimapState.value.clientHeight,
      clientY: event.clientY,
      scrollHeight: minimapState.value.scrollHeight,
      trackHeight,
      trackTop,
    })

    scrollTo(minimapScrollContainer, minimapScrollTarget.expectedScrollTop)
    refreshMinimap()
  }

  function resolveMinimapContext() {
    if (state.currentRootId) {
      return findEditorContextByRootId(state.currentRootId, state.currentTitle) ?? getActiveEditorContext()
    }

    return getActiveEditorContext()
  }

  function resolveMinimapScrollContainer(context: EditorContext) {
    return context.protyle.querySelector<HTMLElement>('.protyle-content')
      ?? context.protyle.querySelector<HTMLElement>('.protyle-wysiwyg')
      ?? context.protyle
  }

  function collectMinimapDocBlocks(
    context: EditorContext,
    scrollContainer: HTMLElement,
    scrollRect: DOMRect,
    scrollHeight: number,
    minimapHeight: number,
  ) {
    if (state.minimapBlocks.length > 0) {
      const totalBlockCount = Math.max(state.searchableBlockCount, state.minimapBlocks.length)
      return state.minimapBlocks.map(block => projectIndexedMinimapDocBlock(block, minimapHeight, totalBlockCount))
    }

    return getUniqueBlockElements(context.protyle).flatMap((blockElement) => {
      const blockId = blockElement.dataset.nodeId
      if (!blockId) {
        return []
      }

      const projectedBlock = projectMinimapDocBlock(
        blockElement,
        scrollContainer,
        scrollRect,
        scrollHeight,
        minimapHeight,
      )

      return projectedBlock ? [projectedBlock] : []
    })
  }

  function projectMinimapDocBlock(
    blockElement: HTMLElement,
    scrollContainer: HTMLElement,
    scrollRect: DOMRect,
    scrollHeight: number,
    minimapHeight: number,
  ): MinimapDocBlock | null {
    const blockId = blockElement.dataset.nodeId
    const blockType = blockElement.dataset.type
    if (!blockId || !blockType) {
      return null
    }

    const blockRect = blockElement.getBoundingClientRect()
    const projectedHeight = Math.max(
      MINIMAP_MARKER_MIN_HEIGHT,
      (Math.max(blockRect.height, 12) / scrollHeight) * minimapHeight,
    )
    const projectedTop = clamp(
      ((blockRect.top - scrollRect.top + scrollContainer.scrollTop) / scrollHeight) * minimapHeight,
      0,
      Math.max(0, minimapHeight - projectedHeight),
    )
    const variant = resolveMinimapDocVariant(blockType)

    return {
      height: projectedHeight,
      id: blockId,
      lines: buildMinimapDocLines(blockId, variant, projectedHeight),
      top: projectedTop,
      variant,
    }
  }

  function syncMinimapScrollContainer(nextContainer: HTMLElement | null) {
    if (minimapScrollContainer === nextContainer) {
      return
    }

    minimapScrollContainer?.removeEventListener('scroll', handleMinimapScroll)
    minimapScrollContainer = nextContainer
    minimapScrollContainer?.addEventListener('scroll', handleMinimapScroll)
  }

  function projectIndexedViewport(
    context: EditorContext,
    scrollRect: DOMRect,
    minimapHeight: number,
  ) {
    if (!state.minimapBlocks.length || state.searchableBlockCount <= 0) {
      return null
    }

    const blockIndexById = new Map(
      state.minimapBlocks.map(block => [block.blockId, block.blockIndex] as const),
    )
    const visibleBlocks = getUniqueBlockElements(context.protyle)
      .flatMap((blockElement) => {
        const blockId = blockElement.dataset.nodeId
        const blockIndex = blockId ? blockIndexById.get(blockId) : undefined
        if (typeof blockIndex !== 'number') {
          return []
        }

        const rect = blockElement.getBoundingClientRect()
        if (rect.bottom <= scrollRect.top || rect.top >= scrollRect.bottom) {
          return []
        }

        return [{
          blockIndex,
          rect,
        }]
      })
      .sort((left, right) => left.blockIndex - right.blockIndex)

    if (!visibleBlocks.length) {
      return null
    }

    const firstVisibleBlock = visibleBlocks[0]!
    const lastVisibleBlock = visibleBlocks[visibleBlocks.length - 1]!
    const firstHeight = Math.max(firstVisibleBlock.rect.height, 1)
    const lastHeight = Math.max(lastVisibleBlock.rect.height, 1)
    const viewportStart = firstVisibleBlock.blockIndex + clamp(
      (scrollRect.top - firstVisibleBlock.rect.top) / firstHeight,
      0,
      1,
    )
    const viewportEnd = lastVisibleBlock.blockIndex + clamp(
      (scrollRect.bottom - lastVisibleBlock.rect.top) / lastHeight,
      0,
      1,
    )
    const projectedHeight = Math.min(
      minimapHeight,
      Math.max(
        28,
        ((viewportEnd - viewportStart) / state.searchableBlockCount) * minimapHeight,
      ),
    )

    return {
      viewportHeight: projectedHeight,
      viewportTop: clamp(
        (viewportStart / state.searchableBlockCount) * minimapHeight,
        0,
        Math.max(0, minimapHeight - projectedHeight),
      ),
    }
  }

  function scrollTo(container: HTMLElement, top: number) {
    if (typeof container.scrollTo === 'function') {
      container.scrollTo({
        behavior: 'auto',
        top,
      })
      return
    }

    container.scrollTop = top
  }
}
