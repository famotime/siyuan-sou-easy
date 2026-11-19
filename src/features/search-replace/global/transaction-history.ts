import { openTab } from 'siyuan'
import { getPluginInstance } from '@/plugin-instance'
import { updateDomBlock } from '../kernel'

export interface ReplaceTransactionItem {
  blockId: string
  rootId: string
  docTitle?: string
  hpath?: string
  blockType?: string
  originalSnippet?: string
  prefixText?: string
  matchedText?: string
  replacedText?: string
  suffixText?: string
  fullContent?: string
  newContent?: string
  originalDom?: string
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

const MAX_TRANSACTION_HISTORY = 50

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
    // 缓存为最新在前，仅保留最近 50 次替换历史（超出即从尾部丢弃最旧的）
    if (transactionsMemoryCache.length > MAX_TRANSACTION_HISTORY) {
      transactionsMemoryCache = transactionsMemoryCache.slice(0, MAX_TRANSACTION_HISTORY)
    }
    await plugin.saveData(TRANSACTION_STORAGE, transactionsMemoryCache)
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
  // 内存缓存与磁盘采用同一截断口径，避免长会话中内存无界增长
  if (transactionsMemoryCache.length > MAX_TRANSACTION_HISTORY) {
    transactionsMemoryCache = transactionsMemoryCache.slice(0, MAX_TRANSACTION_HISTORY)
  }
  await persistTransactions()
  return tx
}

export function getTransactions(): ReplaceTransaction[] {
  return transactionsMemoryCache
}

export interface RevertTransactionResult {
  success: boolean
  revertedCount: number
  skippedCount: number
  error?: string
}

// 模块级回退互斥：Drawer 与分屏 Tab 两个视图可能同时发起回退，
// 对重叠块交错写盘会产生 last-writer-wins 的错乱内容
let revertInFlight: Promise<RevertTransactionResult> | null = null

/**
 * 回滚指定的替换事务批次
 */
export async function revertTransaction(txId: string): Promise<RevertTransactionResult> {
  if (revertInFlight) {
    return {
      success: false,
      revertedCount: 0,
      skippedCount: 0,
      error: '已有回退操作进行中，请等待其完成后再试',
    }
  }

  const execution = (async (): Promise<RevertTransactionResult> => {
    const tx = transactionsMemoryCache.find((t) => t.id === txId)
    if (!tx) {
      return {
        success: false,
        revertedCount: 0,
        skippedCount: 0,
        error: '未找到对应事务记录',
      }
    }
    if (tx.reverted) {
      return {
        success: false,
        revertedCount: 0,
        skippedCount: 0,
        error: '该事务已经回滚，不能重复回滚',
      }
    }

    // 缺少原始 DOM 记录的条目禁止回退：绝不使用猜测/伪造的内容覆盖文档块
    const revertableItems = tx.items.filter((item) => typeof item.originalDom === 'string' && item.originalDom.trim().length > 0)
    if (!revertableItems.length) {
      return {
        success: false,
        revertedCount: 0,
        skippedCount: tx.items.length,
        error: '事务缺少原始 DOM 记录，无法安全回退',
      }
    }

    let revertedCount = 0
    try {
      // 同一块的多条记录共享同一份 originalDom，按块去重避免重复内核写入
      const blockDoms = new Map<string, string>()
      for (const item of revertableItems) {
        if (!blockDoms.has(item.blockId)) {
          blockDoms.set(item.blockId, item.originalDom as string)
        }
      }

      for (const [blockId, originalDom] of blockDoms) {
        await updateDomBlock(blockId, originalDom)
      }
      revertedCount = revertableItems.length

      tx.reverted = true
      await persistTransactions()
      return {
        success: true,
        revertedCount,
        skippedCount: tx.items.length - revertableItems.length,
      }
    } catch (err: any) {
      return {
        success: false,
        revertedCount,
        skippedCount: tx.items.length - revertableItems.length,
        error: err.message || '回滚过程中发生错误',
      }
    }
  })()

  revertInFlight = execution
  try {
    return await execution
  } finally {
    revertInFlight = null
  }
}

export function clearTransactionsMemoryForTesting(): void {
  transactionsMemoryCache = []
}

/**
 * 跨文档跳转并聚焦定位指定块
 */
export async function navigateToBlock(blockId: string): Promise<void> {
  const plugin = getPluginInstance()
  if (!plugin?.app) return
  try {
    await openTab({
      app: plugin.app,
      doc: {
        id: blockId,
        action: ['cb-get-hl', 'cb-get-focus', 'cb-get-context', 'cb-get-rootscroll'],
      },
    })
  } catch (err) {
    console.error('Failed to navigate to block:', err)
  }
}

