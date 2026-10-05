import { getPluginInstance } from '@/plugin-instance'
import { updateDomBlock } from '../kernel'

export interface ReplaceTransactionItem {
  blockId: string
  rootId: string
  docTitle?: string
  hpath?: string
  originalContent: string
  newContent: string
  originalDom?: string
  newDom?: string
}

export interface ReplaceTransaction {
  id: string
  timestamp: number
  formattedTime: string
  query: string
  replacement: string
  itemCount: number
  reverted: boolean
  items: ReplaceTransactionItem[]
}

export const TRANSACTION_STORAGE = 'replace_transactions.json'

let transactionsMemoryCache: ReplaceTransaction[] = []

export function formatDateTime(ts: number): string {
  const date = new Date(ts)
  const Y = date.getFullYear()
  const M = String(date.getMonth() + 1).padStart(2, '0')
  const D = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${Y}-${M}-${D} ${h}:${m}:${s}`
}

export async function loadTransactions(): Promise<ReplaceTransaction[]> {
  const plugin = getPluginInstance()
  if (!plugin) {
    return transactionsMemoryCache
  }
  try {
    const data = await plugin.loadData(TRANSACTION_STORAGE)
    if (Array.isArray(data)) {
      transactionsMemoryCache = data
    }
  } catch {
    // 忽略加载异常
  }
  return transactionsMemoryCache
}

export async function persistTransactions(): Promise<void> {
  const plugin = getPluginInstance()
  if (!plugin) return
  try {
    // 仅保留最近 50 次替换历史
    const trimmed = transactionsMemoryCache.slice(-50)
    await plugin.saveData(TRANSACTION_STORAGE, trimmed)
  } catch (err) {
    console.error('persistTransactions failed:', err)
  }
}

export async function recordTransaction(
  query: string,
  replacement: string,
  items: ReplaceTransactionItem[],
): Promise<ReplaceTransaction> {
  const now = Date.now()
  const tx: ReplaceTransaction = {
    id: `tx_${now}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now,
    formattedTime: formatDateTime(now),
    query,
    replacement,
    itemCount: items.length,
    reverted: false,
    items,
  }

  transactionsMemoryCache.unshift(tx)
  await persistTransactions()
  return tx
}

export function getTransactions(): ReplaceTransaction[] {
  return transactionsMemoryCache
}

/**
 * 回滚指定的替换事务批次
 */
export async function revertTransaction(txId: string): Promise<{ success: boolean, revertedCount: number, error?: string }> {
  const tx = transactionsMemoryCache.find(t => t.id === txId)
  if (!tx) {
    return { success: false, revertedCount: 0, error: '未找到对应事务记录' }
  }
  if (tx.reverted) {
    return { success: false, revertedCount: 0, error: '该事务已经回滚，不能重复回滚' }
  }

  let revertedCount = 0
  try {
    // 逆向遍历更新
    for (const item of tx.items) {
      if (item.originalDom) {
        await updateDomBlock(item.blockId, item.originalDom)
      } else {
        // 如果没有保存完整 DOM，构造基础段落 DOM
        const fallbackDom = `<div data-node-id="${item.blockId}" data-type="NodeParagraph" class="p"><div contenteditable="true" spellcheck="false">${item.originalContent}</div></div>`
        await updateDomBlock(item.blockId, fallbackDom)
      }
      revertedCount++
    }

    tx.reverted = true
    await persistTransactions()
    return { success: true, revertedCount }
  } catch (err: any) {
    return { success: false, revertedCount, error: err.message || '回滚过程中发生错误' }
  }
}

export function clearTransactionsMemoryForTesting(): void {
  transactionsMemoryCache = []
}
