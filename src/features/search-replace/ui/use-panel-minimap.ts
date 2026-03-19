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
  getBlockElement,
  getUniqueBlockElements,
} from '@/features/search-replace/editor'
import type { SearchReplaceState } from '../store/state'
import type {
  EditorContext,
  SearchMatch,
} from '../types'

const PANEL_MARGIN = 8
const MINIMAP_GAP = 12
const MINIMAP_WIDTH = 84
const MINIMAP_MIN_HEIGHT = 140
const MINIMAP_MAX_HEIGHT = 360
const MINIMAP_VIEWPORT_MIN_HEIGHT = 28
const MINIMAP_MARKER_MIN_HEIGHT = 3

interface MinimapDocLine {
  height: number
  left: number
  top: number
  width: number
}

interface MinimapDocBlock {
  height: number
  id: string
  lines: MinimapDocLine[]
  top: number
  variant: 'code' | 'heading' | 'list' | 'paragraph'
}

interface MinimapMarker {
  current: boolean
  height: number
  id: string
  top: number
}

interface MinimapLayout {
  blocks: MinimapDocBlock[]
  clientHeight: number
  height: number
  markers: MinimapMarker[]
  right: number
  scrollHeight: number
  top: number
  viewportHeight: number
  viewportTop: number
}

interface UsePanelMinimapOptions {
  currentMatch: ComputedRef<SearchMatch | null>
  state: Pick<SearchReplaceState, 'currentIndex' | 'currentRootId' | 'currentTitle' | 'matches' | 'minimapVisible' | 'visible'>
}

export function usePanelMinimap({
  currentMatch,
  state,
}: UsePanelMinimapOptions) {
  const minimapRef = ref<HTMLDivElement>()
  const minimapState = ref<MinimapLayout | null>(null)
  let minimapScrollContainer: HTMLElement | null = null

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
    syncMinimapScrollContainer(null)
  }

  function handleMinimapScroll() {
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
    const scrollTop = clamp(scrollContainer.scrollTop || 0, 0, Math.max(0, scrollHeight - clientHeight))
    const height = clamp(scrollRect.height - 16, MINIMAP_MIN_HEIGHT, MINIMAP_MAX_HEIGHT)
    const viewportHeight = Math.min(
      height,
      Math.max(MINIMAP_VIEWPORT_MIN_HEIGHT, (clientHeight / scrollHeight) * height),
    )
    const maxViewportTop = Math.max(0, height - viewportHeight)
    const maxScrollTop = Math.max(0, scrollHeight - clientHeight)
    const viewportTop = maxScrollTop > 0
      ? (scrollTop / maxScrollTop) * maxViewportTop
      : 0

    minimapState.value = {
      blocks: collectMinimapDocBlocks(context, scrollContainer, scrollRect, scrollHeight, height),
      clientHeight,
      height,
      markers: state.matches
        .map(match => projectMinimapMarker(context, scrollContainer, scrollRect, scrollHeight, height, match))
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
    const maxScrollTop = Math.max(0, minimapState.value.scrollHeight - minimapState.value.clientHeight)
    const clickOffset = clamp(event.clientY - trackTop, 0, trackHeight)
    const ratio = trackHeight > 0 ? clickOffset / trackHeight : 0
    const nextScrollTop = clamp(
      (ratio * minimapState.value.scrollHeight) - (minimapState.value.clientHeight / 2),
      0,
      maxScrollTop,
    )

    if (typeof minimapScrollContainer.scrollTo === 'function') {
      minimapScrollContainer.scrollTo({
        behavior: 'auto',
        top: nextScrollTop,
      })
    } else {
      minimapScrollContainer.scrollTop = nextScrollTop
    }

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

    return {
      height: projectedHeight,
      id: blockId,
      lines: buildMinimapDocLines(blockId, resolveMinimapDocVariant(blockType), projectedHeight),
      top: projectedTop,
      variant: resolveMinimapDocVariant(blockType),
    }
  }

  function resolveMinimapDocVariant(blockType: string): MinimapDocBlock['variant'] {
    if (blockType === 'NodeHeading') {
      return 'heading'
    }

    if (blockType === 'NodeListItem') {
      return 'list'
    }

    if (blockType === 'NodeCodeBlock') {
      return 'code'
    }

    return 'paragraph'
  }

  function buildMinimapDocLines(
    blockId: string,
    variant: MinimapDocBlock['variant'],
    blockHeight: number,
  ): MinimapDocLine[] {
    const hash = hashMinimapId(blockId)
    const desiredLineCount = variant === 'heading'
      ? 1
      : variant === 'code'
        ? 3
        : 2
    const maxLineCount = Math.max(1, Math.floor(blockHeight / 4))
    const lineCount = Math.min(desiredLineCount, maxLineCount)
    const lineHeight = variant === 'heading' ? 3 : 2
    const spacing = lineCount === 1 ? 0 : (blockHeight - lineHeight) / (lineCount - 1)

    return Array.from({ length: lineCount }, (_, index) => {
      const left = variant === 'list'
        ? 12
        : variant === 'code'
          ? 4
          : 0
      const width = resolveMinimapLineWidth(variant, index, hash)

      return {
        height: lineHeight,
        left,
        top: lineCount === 1
          ? Math.max(0, (blockHeight - lineHeight) / 2)
          : Math.min(blockHeight - lineHeight, index * spacing),
        width: Math.min(100 - left, width),
      }
    })
  }

  function resolveMinimapLineWidth(
    variant: MinimapDocBlock['variant'],
    index: number,
    hash: number,
  ) {
    switch (variant) {
      case 'heading':
        return 76 + (hash % 14)
      case 'list':
        return index === 0 ? 64 + (hash % 14) : 48 + (hash % 18)
      case 'code':
        return index === 2 ? 62 + (hash % 16) : 78 + (hash % 12)
      case 'paragraph':
      default:
        return index === 0 ? 78 + (hash % 12) : 54 + (hash % 22)
    }
  }

  function hashMinimapId(value: string) {
    return Array.from(value).reduce((sum, char) => {
      return (sum + char.charCodeAt(0)) % 997
    }, 0)
  }

  function projectMinimapMarker(
    context: EditorContext,
    scrollContainer: HTMLElement,
    scrollRect: DOMRect,
    scrollHeight: number,
    minimapHeight: number,
    match: SearchMatch,
  ) {
    const blockElement = getBlockElement(context, match.blockId)
    if (!blockElement) {
      return null
    }

    const blockRect = blockElement.getBoundingClientRect()
    const markerHeight = Math.max(
      MINIMAP_MARKER_MIN_HEIGHT,
      (Math.max(blockRect.height, 12) / scrollHeight) * minimapHeight,
    )
    const markerTop = clamp(
      ((blockRect.top - scrollRect.top + scrollContainer.scrollTop) / scrollHeight) * minimapHeight,
      0,
      Math.max(0, minimapHeight - markerHeight),
    )

    return {
      current: currentMatch.value?.id === match.id,
      height: markerHeight,
      id: match.id,
      top: markerTop,
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
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
