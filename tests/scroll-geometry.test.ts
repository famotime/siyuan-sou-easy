import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  clampScrollOffset,
  isRectVisibleWithinBoundary,
  resolveRectCenterDelta,
} from '@/features/search-replace/editor/scroll-geometry'

describe('scroll geometry helpers', () => {
  it('treats a rect as visible only when it is fully inside the boundary', () => {
    expect(isRectVisibleWithinBoundary(
      createRect({ top: 20, bottom: 80, left: 10, right: 90 }),
      createRect({ top: 0, bottom: 100, left: 0, right: 100 }),
    )).toBe(true)

    expect(isRectVisibleWithinBoundary(
      createRect({ top: -1, bottom: 80, left: 10, right: 90 }),
      createRect({ top: 0, bottom: 100, left: 0, right: 100 }),
    )).toBe(false)
  })

  it('computes center deltas for both axes', () => {
    const subject = createRect({ top: 60, bottom: 100, left: 120, right: 180 })
    const container = createRect({ top: 0, bottom: 80, left: 40, right: 140 })

    expect(resolveRectCenterDelta(subject, container, 'y')).toBe(40)
    expect(resolveRectCenterDelta(subject, container, 'x')).toBe(60)
  })

  it('clamps vertical and horizontal offsets to the scrollable range', () => {
    const verticalContainer = {
      clientHeight: 200,
      clientWidth: 100,
      scrollHeight: 900,
      scrollWidth: 100,
    } as HTMLElement
    const horizontalContainer = {
      clientHeight: 100,
      clientWidth: 120,
      scrollHeight: 100,
      scrollWidth: 500,
    } as HTMLElement

    expect(clampScrollOffset(-30, verticalContainer, 'y')).toBe(0)
    expect(clampScrollOffset(999, verticalContainer, 'y')).toBe(700)
    expect(clampScrollOffset(999, horizontalContainer, 'x')).toBe(380)
  })
})

function createRect({
  bottom,
  left,
  right,
  top,
}: {
  bottom: number
  left: number
  right: number
  top: number
}): DOMRectReadOnly {
  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
    x: left,
    y: top,
    toJSON: () => ({}),
  }
}
