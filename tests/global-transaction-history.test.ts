import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearTransactionsMemoryForTesting,
  getTransactions,
  recordTransaction,
  revertTransaction,
} from '@/features/search-replace/global/transaction-history'
import * as kernel from '@/features/search-replace/kernel'

describe('transaction-history', () => {
  beforeEach(() => {
    clearTransactionsMemoryForTesting()
    vi.restoreAllMocks()
  })

  it('records a new transaction and adds to history', async () => {
    const tx = await recordTransaction('foo', 'bar', [
      {
        blockId: 'b1',
        rootId: 'd1',
        originalContent: 'hello foo',
        newContent: 'hello bar',
      },
    ])

    expect(tx.id).toBeDefined()
    expect(tx.query).toBe('foo')
    expect(tx.replacement).toBe('bar')
    expect(tx.itemCount).toBe(1)
    expect(tx.reverted).toBe(false)

    const list = getTransactions()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(tx.id)
  })

  it('reverts a recorded transaction successfully', async () => {
    const updateSpy = vi.spyOn(kernel, 'updateDomBlock').mockResolvedValue({} as any)

    const tx = await recordTransaction('foo', 'bar', [
      {
        blockId: 'b1',
        rootId: 'd1',
        originalContent: 'original text',
        newContent: 'modified text',
        originalDom: '<div>original text</div>',
        newDom: '<div>modified text</div>',
      },
    ])

    const res = await revertTransaction(tx.id)
    expect(res.success).toBe(true)
    expect(res.revertedCount).toBe(1)
    expect(updateSpy).toHaveBeenCalledWith('b1', '<div>original text</div>')

    const list = getTransactions()
    expect(list[0].reverted).toBe(true)

    // 重复回滚应被阻止
    const secondTry = await revertTransaction(tx.id)
    expect(secondTry.success).toBe(false)
    expect(secondTry.error).toContain('已经回滚')
  })
})
