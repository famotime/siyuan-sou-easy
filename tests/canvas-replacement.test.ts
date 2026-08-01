import { describe, expect, it, vi } from 'vitest'

import { replaceCanvasMatchGroups } from '@/features/search-replace/canvas/replacement'

describe('canvas replacement', () => {
  it('groups replacements by canvas text target', async () => {
    const replaceTextRanges = vi.fn(async () => ({ appliedCount: 2, revision: 'r2' }))
    const result = await replaceCanvasMatchGroups({
      getReplacementText: () => 'Beta',
      matches: [
        {
          start: 0, occ: 0, end: 5, occ: 0,
          matchedText: 'Alpha',
          canvas: { targetId: 'node:t1:text', host: { replaceTextRanges } },
          replaceable: true,
          sourceKind: 'canvas',
        },
        {
          start: 6, occ: 0, end: 11, occ: 0,
          matchedText: 'Alpha',
          canvas: { targetId: 'node:t1:text', host: { replaceTextRanges } },
          replaceable: true,
          sourceKind: 'canvas',
        },
        {
          start: 0, occ: 0, end: 5, occ: 0,
          matchedText: 'Alpha',
          canvas: { targetId: 'node:f1:note', host: { replaceTextRanges } },
          replaceable: false,
          sourceKind: 'canvas',
        },
      ] as any,
    })

    expect(replaceTextRanges).toHaveBeenCalledWith('node:t1:text', [
      { start: 0, end: 5, text: 'Beta' },
      { start: 6, end: 11, text: 'Beta' },
    ])
    expect(result).toEqual({ replacedCount: 2, skippedCount: 1 })
  })
})
