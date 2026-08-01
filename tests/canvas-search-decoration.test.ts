import { describe, expect, it, vi } from 'vitest'

import {
  scrollCanvasMatchIntoView,
  syncCanvasSearchDecorations,
} from '@/features/search-replace/canvas/decorations'

describe('canvas search decorations', () => {
  it('passes canvas match ranges to the host and marks current match', () => {
    const syncDecorations = vi.fn()
    const host = { syncDecorations }
    syncCanvasSearchDecorations({
      context: { sourceKind: 'canvas', canvas: { host } } as any,
      currentMatch: { id: 'm2' } as any,
      matches: [
        { id: 'm1', start: 0, occ: 0, end: 5, occ: 0, canvas: { targetId: 'node:t1:text' }, sourceKind: 'canvas' },
        { id: 'm2', start: 6, occ: 0, end: 11, occ: 0, canvas: { targetId: 'node:t1:text' }, sourceKind: 'canvas' },
      ] as any,
    })

    expect(syncDecorations).toHaveBeenCalledWith([
      { current: false, start: 0, end: 5, targetId: 'node:t1:text' },
      { current: true, start: 6, end: 11, targetId: 'node:t1:text' },
    ])
  })

  it('returns scrolled for canvas matches with a target host', () => {
    const reveal = vi.fn(async () => true)
    const result = scrollCanvasMatchIntoView({
      canvas: { host: { reveal } },
      sourceKind: 'canvas',
    } as any, {
      start: 3, occ: 0, end: 8, occ: 0,
      canvas: { targetId: 'node:t1:text' },
    } as any)

    expect(result).toBe('scrolled')
    expect(reveal).toHaveBeenCalledWith('node:t1:text', { start: 3, end: 8 })
  })
})
