import {
  computed,
  onBeforeUnmount,
  ref,
  type Ref,
} from 'vue'
import type { PanelPosition } from '../store/state'

const PANEL_MARGIN = 8
const DEFAULT_PANEL_WIDTH = 648
const MIN_PANEL_WIDTH = 420
const NON_DRAG_SELECTOR = [
  'input',
  'textarea',
  'button',
  'select',
  'option',
  'a',
  '[contenteditable]:not([contenteditable="false"])',
  '.sfsr-no-drag',
].join(', ')

interface UsePanelFrameOptions {
  getPanelPosition: () => PanelPosition | null
  onViewportResize?: () => void
  panelRef: Ref<HTMLDivElement | undefined>
  persistPanelPosition: () => void
  resetStoredPanelPosition: () => void
  setPanelPosition: (position: PanelPosition | null, persist?: boolean) => void
}

export function usePanelFrame({
  getPanelPosition,
  onViewportResize,
  panelRef,
  persistPanelPosition,
  resetStoredPanelPosition,
  setPanelPosition,
}: UsePanelFrameOptions) {
  const panelWidth = ref(resolveDefaultPanelWidth())

  let dragState: {
    pointerId: number
    panelLeft: number
    panelTop: number
    startClientX: number
    startClientY: number
  } | null = null

  let resizeState: {
    pointerId: number
    panelRight: number
    panelTop: number
  } | null = null

  const panelStyle = computed(() => {
    const style: Record<string, string> = {
      width: `${panelWidth.value}px`,
    }

    const panelPosition = getPanelPosition()
    if (!panelPosition) {
      return style
    }

    return {
      ...style,
      left: `${panelPosition.left}px`,
      top: `${panelPosition.top}px`,
      transform: 'none',
    }
  })

  function onPanelPointerDown(event: PointerEvent) {
    if (event.button !== 0 || !canStartPanelDrag(event.target)) {
      return
    }

    event.preventDefault()
    startDrag(event)
  }

  function onResizeHandlePointerDown(event: PointerEvent) {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()
    startResize(event)
  }

  function onPanelDoubleClick(event: MouseEvent) {
    if (!canStartPanelDrag(event.target)) {
      return
    }

    resetStoredPanelPosition()
  }

  function stopPanelInteractions() {
    stopDrag()
    stopResize()
  }

  function syncPanelBoundsToViewport() {
    panelWidth.value = clampPanelWidth(panelWidth.value)

    const panelPosition = getPanelPosition()
    if (panelPosition) {
      setPanelPosition(clampPanelPosition(panelPosition), false)
    }
  }

  function handleViewportResize() {
    syncPanelBoundsToViewport()
    onViewportResize?.()
  }

  window.addEventListener('resize', handleViewportResize)

  onBeforeUnmount(() => {
    stopPanelInteractions()
    window.removeEventListener('resize', handleViewportResize)
  })

  return {
    onPanelDoubleClick,
    onPanelPointerDown,
    onResizeHandlePointerDown,
    panelStyle,
    syncPanelBoundsToViewport,
    stopPanelInteractions,
  }

  function startDrag(event: PointerEvent) {
    const panel = panelRef.value
    if (!panel) {
      return
    }

    stopResize()

    const rect = panel.getBoundingClientRect()
    setPanelPosition({
      left: rect.left,
      top: rect.top,
    }, false)

    dragState = {
      pointerId: event.pointerId,
      panelLeft: rect.left,
      panelTop: rect.top,
      startClientX: event.clientX,
      startClientY: event.clientY,
    }

    document.body.classList.add('sfsr-dragging')
    window.addEventListener('pointermove', onDragMove)
    window.addEventListener('pointerup', stopDrag)
    window.addEventListener('pointercancel', stopDrag)
  }

  function startResize(event: PointerEvent) {
    const panel = panelRef.value
    if (!panel) {
      return
    }

    stopDrag()

    const rect = panel.getBoundingClientRect()
    const width = clampPanelWidth(rect.width)
    panelWidth.value = width
    setPanelPosition({
      left: rect.right - width,
      top: rect.top,
    }, false)

    resizeState = {
      pointerId: event.pointerId,
      panelRight: rect.right,
      panelTop: rect.top,
    }

    document.body.classList.add('sfsr-resizing')
    window.addEventListener('pointermove', onResizeMove)
    window.addEventListener('pointerup', stopResize)
    window.addEventListener('pointercancel', stopResize)
  }

  function onDragMove(event: PointerEvent) {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return
    }

    const nextLeft = dragState.panelLeft + (event.clientX - dragState.startClientX)
    const nextTop = dragState.panelTop + (event.clientY - dragState.startClientY)
    setPanelPosition(clampPanelPosition({
      left: nextLeft,
      top: nextTop,
    }), false)
  }

  function stopDrag(event?: PointerEvent) {
    if (event && dragState && event.pointerId !== dragState.pointerId) {
      return
    }

    dragState = null
    persistPanelPosition()
    document.body.classList.remove('sfsr-dragging')
    window.removeEventListener('pointermove', onDragMove)
    window.removeEventListener('pointerup', stopDrag)
    window.removeEventListener('pointercancel', stopDrag)
  }

  function onResizeMove(event: PointerEvent) {
    if (!resizeState || event.pointerId !== resizeState.pointerId) {
      return
    }

    const nextWidth = clampPanelWidth(resizeState.panelRight - event.clientX)
    const nextLeft = resizeState.panelRight - nextWidth
    panelWidth.value = nextWidth
    setPanelPosition(clampPanelPosition({
      left: nextLeft,
      top: resizeState.panelTop,
    }, nextWidth), false)
  }

  function stopResize(event?: PointerEvent) {
    if (event && resizeState && event.pointerId !== resizeState.pointerId) {
      return
    }

    resizeState = null
    persistPanelPosition()
    document.body.classList.remove('sfsr-resizing')
    window.removeEventListener('pointermove', onResizeMove)
    window.removeEventListener('pointerup', stopResize)
    window.removeEventListener('pointercancel', stopResize)
  }

  function canStartPanelDrag(target: EventTarget | null) {
    const element = resolveEventElement(target)

    if (!element) {
      return true
    }

    return !element.closest(NON_DRAG_SELECTOR)
  }

  function resolveEventElement(target: EventTarget | null) {
    if (target instanceof Element) {
      return target
    }

    if (target instanceof Node) {
      return target.parentElement
    }

    return null
  }

  function clampPanelPosition(position: PanelPosition, width = panelWidth.value) {
    const panelHeight = panelRef.value?.offsetHeight ?? 0
    const maxLeft = Math.max(PANEL_MARGIN, window.innerWidth - width - PANEL_MARGIN)
    const maxTop = Math.max(PANEL_MARGIN, window.innerHeight - panelHeight - PANEL_MARGIN)

    return {
      left: clamp(position.left, PANEL_MARGIN, maxLeft),
      top: clamp(position.top, PANEL_MARGIN, maxTop),
    }
  }

  function clampPanelWidth(width: number) {
    const maxWidth = Math.max(MIN_PANEL_WIDTH, window.innerWidth - (PANEL_MARGIN * 2))
    return clamp(width, MIN_PANEL_WIDTH, maxWidth)
  }
}

function resolveDefaultPanelWidth() {
  if (typeof window === 'undefined') {
    return DEFAULT_PANEL_WIDTH
  }

  const maxWidth = Math.max(MIN_PANEL_WIDTH, window.innerWidth - (PANEL_MARGIN * 2))
  return clamp(DEFAULT_PANEL_WIDTH, MIN_PANEL_WIDTH, maxWidth)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
