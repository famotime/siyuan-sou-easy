import type {
  SearchMatch,
  SearchableBlockSummary,
} from '../types'

export const PANEL_MARGIN = 8
export const MINIMAP_GAP = 12
export const MINIMAP_WIDTH = 84
export const MINIMAP_MIN_HEIGHT = 140
export const MINIMAP_MAX_HEIGHT = 360
export const MINIMAP_VIEWPORT_MIN_HEIGHT = 28
export const MINIMAP_MARKER_MIN_HEIGHT = 3

export type MinimapDocVariant = 'code' | 'heading' | 'list' | 'paragraph'

export interface MinimapDocLine {
  height: number
  left: number
  top: number
  width: number
}

export interface MinimapDocBlock {
  height: number
  id: string
  lines: MinimapDocLine[]
  top: number
  variant: MinimapDocVariant
}

export interface MinimapMarker {
  current: boolean
  height: number
  id: string
  top: number
}

export interface MinimapLayout {
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

export interface MinimapScrollTarget {
  expectedScrollTop: number
  lastMaxScrollTop: number
  ratio: number
}

export interface ViewportProjection {
  viewportHeight: number
  viewportTop: number
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function computeMinimapViewport({
  clientHeight,
  height,
  indexedViewport,
  scrollHeight,
  scrollTarget,
  scrollTop,
}: {
  clientHeight: number
  height: number
  indexedViewport: ViewportProjection | null
  scrollHeight: number
  scrollTarget: MinimapScrollTarget | null
  scrollTop: number
}) {
  const fallbackViewportHeight = Math.min(
    height,
    Math.max(MINIMAP_VIEWPORT_MIN_HEIGHT, (clientHeight / scrollHeight) * height),
  )
  const maxViewportTop = Math.max(0, height - fallbackViewportHeight)
  const maxScrollTop = Math.max(0, scrollHeight - clientHeight)
  const fallbackViewportTop = maxScrollTop > 0
    ? (scrollTop / maxScrollTop) * maxViewportTop
    : 0
  const viewportHeight = indexedViewport?.viewportHeight ?? fallbackViewportHeight
  const viewportTop = scrollTarget
    ? clamp((scrollTarget.ratio * height) - (viewportHeight / 2), 0, Math.max(0, height - viewportHeight))
    : indexedViewport?.viewportTop ?? fallbackViewportTop

  return {
    viewportHeight,
    viewportTop,
  }
}

export function createMinimapScrollTarget({
  clientHeight,
  clientY,
  scrollHeight,
  trackHeight,
  trackTop,
}: {
  clientHeight: number
  clientY: number
  scrollHeight: number
  trackHeight: number
  trackTop: number
}) {
  const maxScrollTop = Math.max(0, scrollHeight - clientHeight)
  const clickOffset = clamp(clientY - trackTop, 0, trackHeight)
  const ratio = trackHeight > 0 ? clickOffset / trackHeight : 0
  const expectedScrollTop = clamp(
    (ratio * scrollHeight) - (clientHeight / 2),
    0,
    maxScrollTop,
  )

  return {
    expectedScrollTop,
    lastMaxScrollTop: maxScrollTop,
    ratio,
  }
}

export function syncMinimapScrollTarget(
  target: MinimapScrollTarget | null,
  scrollHeight: number,
  clientHeight: number,
) {
  if (!target) {
    return null
  }

  const maxScrollTop = Math.max(0, scrollHeight - clientHeight)
  if (maxScrollTop <= target.lastMaxScrollTop) {
    return target
  }

  return {
    expectedScrollTop: clamp(
      (target.ratio * scrollHeight) - (clientHeight / 2),
      0,
      maxScrollTop,
    ),
    lastMaxScrollTop: maxScrollTop,
    ratio: target.ratio,
  }
}

export function shouldReleaseMinimapScrollTarget(
  target: MinimapScrollTarget | null,
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
) {
  if (!target) {
    return false
  }

  const maxScrollTop = Math.max(0, scrollHeight - clientHeight)
  const scrollDelta = Math.abs(scrollTop - target.expectedScrollTop)
  return maxScrollTop <= target.lastMaxScrollTop && scrollDelta > 4
}

export function projectIndexedMinimapDocBlock(
  block: SearchableBlockSummary,
  minimapHeight: number,
  totalBlockCount: number,
): MinimapDocBlock {
  const projectedHeight = Math.max(
    MINIMAP_MARKER_MIN_HEIGHT,
    minimapHeight / totalBlockCount,
  )
  const variant = resolveMinimapDocVariant(block.blockType)
  const projectedTop = clamp(
    (block.blockIndex / totalBlockCount) * minimapHeight,
    0,
    Math.max(0, minimapHeight - projectedHeight),
  )

  return {
    height: projectedHeight,
    id: block.blockId,
    lines: buildMinimapDocLines(block.blockId, variant, projectedHeight),
    top: projectedTop,
    variant,
  }
}

export function projectIndexedMinimapMarker(
  minimapHeight: number,
  match: SearchMatch,
  searchableBlockCount: number,
): Omit<MinimapMarker, 'current'> | null {
  if (searchableBlockCount <= 0) {
    return null
  }

  const indexedHeight = Math.max(
    MINIMAP_MARKER_MIN_HEIGHT,
    minimapHeight / searchableBlockCount,
  )
  const indexedTop = clamp(
    ((match.blockIndex + 0.5) / searchableBlockCount) * minimapHeight - (indexedHeight / 2),
    0,
    Math.max(0, minimapHeight - indexedHeight),
  )

  return {
    height: indexedHeight,
    id: match.id,
    top: indexedTop,
  }
}

export function resolveMinimapDocVariant(blockType: string): MinimapDocVariant {
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

export function buildMinimapDocLines(
  blockId: string,
  variant: MinimapDocVariant,
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
  variant: MinimapDocVariant,
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
