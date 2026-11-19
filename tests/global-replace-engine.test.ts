import { describe, expect, it, vi } from 'vitest'
import {
  cancelActiveBatchReplace,
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

  it('does not interpret replacement patterns like $& in replaced text', () => {
    const dom = '<div class="p"><span>price</span></div>'
    // 函数替换器语义：$&/$1 等模式按字面量插入，不再被 String.replace 二次解释
    const updated = replaceTextInDom(dom, 'price', '$&$$')
    expect(updated).toBe('<div class="p"><span>$&$$</span></div>')
  })

  it('skips occurrences inside tag attributes and only replaces text content', () => {
    const dom = '<div data-x="apple">apple pie</div>'
    const updated = replaceTextInDom(dom, 'apple', 'banana')
    expect(updated).toBe('<div data-x="apple">banana pie</div>')
  })

  it('returns the dom unchanged when the text only appears inside attributes', () => {
    const dom = '<div data-x="apple"></div>'
    expect(replaceTextInDom(dom, 'apple', 'banana')).toBe(dom)
  })

  it('counts unmatched items as skipped instead of blindly reporting success', async () => {
    vi.spyOn(kernel, 'getBlockDoms').mockResolvedValue({
      b1: '<div class="p">fresh content</div>',
    })
    const updateSpy = vi.spyOn(kernel, 'updateDomBlock').mockResolvedValue({} as any)

    const res = await executeBatchReplace(buildSingleItemSummary('b1', 'stale-text', 'replacement'), 'stale-text', 'replacement')
    expect(res.success).toBe(true)
    expect(res.replacedCount).toBe(0)
    expect(res.skippedCount).toBe(1)
    expect(res.transactionId).toBeUndefined()
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('aborts the batch when cancellation is requested mid-run', async () => {
    const updateSpy = vi.spyOn(kernel, 'updateDomBlock').mockImplementation(async () => {
      // 首次写盘后请求取消，模拟 Dock 销毁/插件卸载
      cancelActiveBatchReplace()
      return {} as any
    })
    vi.spyOn(kernel, 'getBlockDoms').mockResolvedValue({
      b1: '<div class="p">alpha</div>',
      b2: '<div class="p">alpha</div>',
      b3: '<div class="p">alpha</div>',
    })

    const summary: DiffSummary = {
      totalCount: 3,
      includedCount: 3,
      excludedCount: 0,
      affectedDocCount: 1,
      groups: [
        {
          rootId: 'd1',
          docTitle: 'Doc 1',
          hpath: '/d1',
          allExcluded: false,
          items: ['b1', 'b2', 'b3'].map(blockId => buildSingleItemSummary(blockId, 'alpha', 'beta').groups[0]!.items[0]!),
        },
      ],
    }

    const res = await executeBatchReplace(summary, 'alpha', 'beta')
    expect(res.cancelled).toBe(true)
    expect(res.success).toBe(false)
    expect(res.replacedCount).toBe(1)
    expect(updateSpy).toHaveBeenCalledTimes(1)
  })
})

function buildSingleItemSummary(blockId: string, matchedText: string, replacedText: string): DiffSummary {
  return {
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
            blockId,
            rootId: 'd1',
            docTitle: 'Doc 1',
            hpath: '/d1',
            blockType: 'p',
            originalSnippet: matchedText,
            prefixText: '',
            matchedText,
            replacedText,
            suffixText: '',
            fullContent: matchedText,
            newContent: replacedText,
            excluded: false,
            startOffset: 0,
            endOffset: matchedText.length,
          },
        ],
      },
    ],
  }
}
