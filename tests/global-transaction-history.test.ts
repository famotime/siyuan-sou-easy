import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setPluginInstance } from '@/plugin-instance'
import {
  clearTransactionsMemoryForTesting,
  getTransactions,
  persistTransactions,
  recordTransaction,
  revertTransaction,
  TRANSACTION_STORAGE,
  type ReplaceTransaction,
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

  it('skips items without originalDom and reports skippedCount', async () => {
    const updateSpy = vi.spyOn(kernel, 'updateDomBlock').mockResolvedValue({} as any)

    const tx = await recordTransaction('foo', 'bar', [
      {
        blockId: 'b1',
        rootId: 'd1',
        originalDom: '<div>original one</div>',
      },
      {
        blockId: 'b2',
        rootId: 'd1',
        // 缺少 originalDom：不允许伪造内容回退
      },
    ])

    const res = await revertTransaction(tx.id)
    expect(res.success).toBe(true)
    expect(res.revertedCount).toBe(1)
    expect(res.skippedCount).toBe(1)
    expect(updateSpy).toHaveBeenCalledTimes(1)
    expect(updateSpy).toHaveBeenCalledWith('b1', '<div>original one</div>')
    expect(updateSpy).not.toHaveBeenCalledWith('b2', expect.any(String))
    expect(getTransactions()[0].reverted).toBe(true)
  })

  it('serializes concurrent revert attempts into a single in-flight operation', async () => {
    let resolveFirstWrite!: () => void
    const updateSpy = vi.spyOn(kernel, 'updateDomBlock').mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        resolveFirstWrite = resolve
      })
      return {} as any
    })

    const tx = await recordTransaction('foo', 'bar', [
      {
        blockId: 'b1',
        rootId: 'd1',
        originalDom: '<div>original one</div>',
      },
    ])

    const firstRevert = revertTransaction(tx.id)
    // 首次回退仍在写盘时再次发起（另一视图触发）：必须被互斥拒绝
    const secondRevert = await revertTransaction(tx.id)
    expect(secondRevert.success).toBe(false)
    expect(secondRevert.error).toContain('已有回退操作进行中')

    resolveFirstWrite()
    const firstResult = await firstRevert
    expect(firstResult.success).toBe(true)
    expect(updateSpy).toHaveBeenCalledTimes(1)

    // 互斥释放后按正常语义拒绝重复回滚
    const thirdRevert = await revertTransaction(tx.id)
    expect(thirdRevert.success).toBe(false)
    expect(thirdRevert.error).toContain('已经回滚')
  })

  it('refuses to revert when no item carries an originalDom record', async () => {
    const updateSpy = vi.spyOn(kernel, 'updateDomBlock').mockResolvedValue({} as any)

    const tx = await recordTransaction('foo', 'bar', [
      {
        blockId: 'b1',
        rootId: 'd1',
        fullContent: 'original text',
        newContent: 'replaced text',
      },
    ])

    const res = await revertTransaction(tx.id)
    expect(res.success).toBe(false)
    expect(res.revertedCount).toBe(0)
    expect(res.skippedCount).toBe(1)
    expect(res.error).toContain('无法安全回退')
    expect(updateSpy).not.toHaveBeenCalled()
    expect(getTransactions()[0].reverted).toBe(false)
  })

  it('trims memory cache to the most recent 50 transactions with newest first', async () => {
    const saveSpy = vi.fn()
    setPluginInstance({
      loadData: vi.fn(async () => null),
      saveData: saveSpy,
    } as any)

    let lastTx: ReplaceTransaction | null = null
    for (let i = 0; i < 55; i++) {
      lastTx = await recordTransaction(`query-${i}`, 'replacement', [
        { blockId: `b${i}`, rootId: 'd1', originalDom: `<div>original ${i}</div>` },
      ])
    }

    const list = getTransactions()
    expect(list).toHaveLength(50)
    expect(list[0].id).toBe(lastTx!.id)
    expect(list[0].query).toBe('query-54')

    await persistTransactions()
    const persisted = saveSpy.mock.calls.at(-1)?.[1] as ReplaceTransaction[]
    expect(persisted).toHaveLength(50)
    expect(persisted[0].query).toBe('query-54')
    expect(persisted.at(-1)?.query).toBe('query-5')

    setPluginInstance(null as any)
    expect(saveSpy).toHaveBeenCalledWith(TRANSACTION_STORAGE, expect.any(Array))
  })
})
