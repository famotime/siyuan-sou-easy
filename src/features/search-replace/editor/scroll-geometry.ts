type ScrollAxis = 'x' | 'y'

interface ScrollOffsetContainer {
  clientHeight: number
  clientWidth: number
  scrollHeight: number
  scrollWidth: number
}

export function isRectVisibleWithinBoundary(
  elementRect: DOMRect | DOMRectReadOnly,
  boundaryRect: DOMRect | DOMRectReadOnly,
) {
  return (
    elementRect.top >= boundaryRect.top
    && elementRect.bottom <= boundaryRect.bottom
    && elementRect.left >= boundaryRect.left
    && elementRect.right <= boundaryRect.right
  )
}

export function resolveRectCenterDelta(
  subjectRect: DOMRect | DOMRectReadOnly,
  containerRect: DOMRect | DOMRectReadOnly,
  axis: ScrollAxis,
) {
  const subjectCenter = axis === 'y'
    ? (subjectRect.top + subjectRect.bottom) / 2
    : (subjectRect.left + subjectRect.right) / 2
  const containerCenter = axis === 'y'
    ? (containerRect.top + containerRect.bottom) / 2
    : (containerRect.left + containerRect.right) / 2

  return subjectCenter - containerCenter
}

export function clampScrollOffset(
  offset: number,
  container: ScrollOffsetContainer,
  axis: ScrollAxis,
) {
  const maxScrollOffset = axis === 'y'
    ? Math.max(0, (container.scrollHeight || 0) - (container.clientHeight || 0))
    : Math.max(0, (container.scrollWidth || 0) - (container.clientWidth || 0))

  return Math.max(0, Math.min(maxScrollOffset, offset))
}

export type { ScrollAxis, ScrollOffsetContainer }
