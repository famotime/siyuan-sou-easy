import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  buildMinimapDocLines,
  computeMinimapViewport,
  createMinimapScrollTarget,
  projectIndexedMinimapDocBlock,
  projectIndexedMinimapMarker,
  syncMinimapScrollTarget,
} from '@/features/search-replace/ui/minimap-layout'

describe('minimap layout helpers', () => {
  it('creates a clamped scroll target from a track click', () => {
    const target = createMinimapScrollTarget({
      clientHeight: 300,
      clientY: 500,
      scrollHeight: 1200,
      trackHeight: 280,
      trackTop: 100,
    })

    expect(target.ratio).toBeCloseTo(1)
    expect(target.expectedScrollTop).toBe(900)
    expect(target.lastMaxScrollTop).toBe(900)
  })

  it('keeps the clicked ratio stable when lazy loading increases scroll height', () => {
    const initialTarget = createMinimapScrollTarget({
      clientHeight: 300,
      clientY: 280,
      scrollHeight: 1200,
      trackHeight: 280,
      trackTop: 100,
    })

    const syncedTarget = syncMinimapScrollTarget(initialTarget, 2400, 300)

    expect(syncedTarget).not.toBeNull()
    expect(syncedTarget?.ratio).toBeCloseTo(initialTarget.ratio)
    expect((syncedTarget?.expectedScrollTop ?? 0)).toBeGreaterThan(initialTarget.expectedScrollTop)
  })

  it('prefers an indexed viewport when one is available', () => {
    const viewport = computeMinimapViewport({
      clientHeight: 300,
      height: 280,
      indexedViewport: {
        viewportHeight: 60,
        viewportTop: 140,
      },
      scrollHeight: 1200,
      scrollTarget: null,
      scrollTop: 300,
    })

    expect(viewport).toEqual({
      viewportHeight: 60,
      viewportTop: 140,
    })
  })

  it('projects indexed blocks and markers into minimap coordinates', () => {
    const block = projectIndexedMinimapDocBlock({
      blockId: 'block-2',
      blockIndex: 1,
      blockType: 'NodeHeading',
    }, 240, 6)
    const marker = projectIndexedMinimapMarker(240, {
      blockId: 'block-5',
      blockIndex: 4,
      blockType: 'NodeParagraph',
      end: 3,
      id: 'block-5:0:3',
      matchedText: 'foo',
      previewText: '[foo]',
      replaceable: true,
      rootId: 'root-1',
      start: 0,
    }, 6)

    expect(block.variant).toBe('heading')
    expect(block.top).toBeGreaterThan(0)
    expect(marker?.top).toBeGreaterThan(block.top)
  })

  it('builds deterministic minimap lines for the same block id', () => {
    const first = buildMinimapDocLines('block-1', 'paragraph', 24)
    const second = buildMinimapDocLines('block-1', 'paragraph', 24)

    expect(second).toEqual(first)
  })
})
