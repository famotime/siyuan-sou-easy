import { describe, expect, it, vi } from 'vitest'
import {
  executeBatchReplace,
  replaceTextInDom,
} from '@/features/search-replace/global/replace-engine'
import type { DiffSummary } from '@/features/search-replace/global/diff-builder'
import * as kernel from '@/features/search-replace/kernel'

describe('replace-engine', () => {
  it('replaces text in dom correctly', () => {
    const dom = '<div class="p"><span>Hello world</span></div>'
    const updated = replaceTextInDom(dom, 'world', 'SiYuan')
    expect(updated).toBe('<div class="p"><span>Hello SiYuan</span></div>')
  })

  it('executes batch replace and calls kernel updateDomBlock', async () => {
    vi.spyOn(kernel, 'getBlockDoms').mockResolvedValue({
      b1: '<div class="p">apple pie</div>',
    })
    const updateSpy = vi.spyOn(kernel, 'updateDomBlock').mockResolvedValue({} as any)

    const diffSummary: DiffSummary = {
      totalCount: 1,
      includedCount: 1,
      excludedCount: 0,
      affectedDocCount: 1,
      groups: [
        {
          rootId: 'd1',
          docTitle: 'Doc 1',
          hpath: '/d1',
          allExcluded: false,
          items: [
            {
              matchId: 'm1',
              blockId: 'b1',
              rootId: 'd1',
              docTitle: 'Doc 1',
              hpath: '/d1',
              blockType: 'p',
              originalSnippet: 'apple pie',
              prefixText: '',
              matchedText: 'apple',
              replacedText: 'banana',
              suffixText: ' pie',
              fullContent: 'apple pie',
              newContent: 'banana pie',
              excluded: false,
              startOffset: 0,
              endOffset: 5,
            },
          ],
        },
      ],
    }

    const res = await executeBatchReplace(diffSummary, 'apple', 'banana')
    expect(res.success).toBe(true)
    expect(res.replacedCount).toBe(1)
    expect(res.transactionId).toBeDefined()
    expect(updateSpy).toHaveBeenCalledWith('b1', '<div class="p">banana pie</div>')
  })
})
