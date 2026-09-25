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
  // 当元素高度超过边界时，只要元素与边界在垂直方向有交集即可，避免超大表格/段落永远判定为不可见
  const verticallyVisible = elementRect.height >= boundaryRect.height
    ? (elementRect.top < boundaryRect.bottom && elementRect.bottom > boundaryRect.top)
    : (elementRect.top >= boundaryRect.top && elementRect.bottom <= boundaryRect.bottom)

  // 当元素宽度超过边界时，只要元素与边界在水平方向有交集即可
  const horizontallyVisible = elementRect.width >= boundaryRect.width
    ? (elementRect.left < boundaryRect.right && elementRect.right > boundaryRect.left)
    : (elementRect.left >= boundaryRect.left && elementRect.right <= boundaryRect.right)

  return verticallyVisible && horizontallyVisible
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
