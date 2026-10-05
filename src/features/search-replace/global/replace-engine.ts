import { getBlockDoms, updateDomBlock } from '../kernel'
import type { DiffItem, DiffSummary } from './diff-builder'
import {
  type ReplaceTransactionItem,
  recordTransaction,
} from './transaction-history'

export interface ReplaceExecutionResult {
  success: boolean
  totalCount: number
  replacedCount: number
  skippedCount: number
  transactionId?: string
  error?: string
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 针对纯文本在 DOM 节点中进行简单内容替换
 */
export function replaceTextInDom(domStr: string, originalText: string, newText: string): string {
  if (!domStr) {
    return ''
  }
  // 如果 DOM 包含原始纯文本，直接首个匹配替换
  if (domStr.includes(originalText)) {
    return domStr.replace(originalText, newText)
  }
  return domStr
}

/**
 * 执行全库批量替换任务
 */
export async function executeBatchReplace(
  diffSummary: DiffSummary,
  query: string,
  replacement: string,
  onProgress?: (processed: number, total: number) => void,
): Promise<ReplaceExecutionResult> {
  const activeItems: DiffItem[] = []
  for (const group of diffSummary.groups) {
    for (const item of group.items) {
      if (!item.excluded) {
        activeItems.push(item)
      }
    }
  }

  if (activeItems.length === 0) {
    return {
      success: true,
      totalCount: 0,
      replacedCount: 0,
      skippedCount: 0,
    }
  }

  const batchSize = 15
  let replacedCount = 0
  let skippedCount = 0
  const transactionItems: ReplaceTransactionItem[] = []

  // 获取所有涉及的块 DOM
  const blockIds = Array.from(new Set(activeItems.map(i => i.blockId)))
  let domMap: Record<string, string> = {}
  try {
    domMap = await getBlockDoms(blockIds)
  } catch {
    domMap = {}
  }

  // 按块进行分组归并更新，避免对同一个块重复覆盖写入
  const blockGroups = new Map<string, DiffItem[]>()
  for (const item of activeItems) {
    let list = blockGroups.get(item.blockId)
    if (!list) {
      list = []
      blockGroups.set(item.blockId, list)
    }
    list.push(item)
  }

  const allBlockIds = Array.from(blockGroups.keys())
  const totalBlocks = allBlockIds.length

  for (let i = 0; i < totalBlocks; i += batchSize) {
    const chunk = allBlockIds.slice(i, i + batchSize)

    for (const blockId of chunk) {
      const itemsInBlock = blockGroups.get(blockId) || []
      const originalDom = domMap[blockId]

      if (originalDom) {
        let updatedDom = originalDom
        for (const it of itemsInBlock) {
          updatedDom = replaceTextInDom(updatedDom, it.matchedText, it.replacedText)
        }

        try {
          await updateDomBlock(blockId, updatedDom)
          replacedCount += itemsInBlock.length

          transactionItems.push({
            blockId,
            rootId: itemsInBlock[0].rootId,
            docTitle: itemsInBlock[0].docTitle,
            hpath: itemsInBlock[0].hpath,
            originalContent: itemsInBlock[0].fullContent,
            newContent: itemsInBlock[0].newContent,
            originalDom,
            newDom: updatedDom,
          })
        } catch {
          skippedCount += itemsInBlock.length
        }
      } else {
        // 如果无法获取 DOM，构造安全回退段落
        const it = itemsInBlock[0]
        const fallbackDom = `<div data-node-id="${blockId}" data-type="NodeParagraph" class="p"><div contenteditable="true" spellcheck="false">${it.newContent}</div></div>`
        try {
          await updateDomBlock(blockId, fallbackDom)
          replacedCount += itemsInBlock.length
          transactionItems.push({
            blockId,
            rootId: it.rootId,
            docTitle: it.docTitle,
            hpath: it.hpath,
            originalContent: it.fullContent,
            newContent: it.newContent,
            originalDom: `<div data-node-id="${blockId}" data-type="NodeParagraph" class="p"><div contenteditable="true" spellcheck="false">${it.fullContent}</div></div>`,
            newDom: fallbackDom,
          })
        } catch {
          skippedCount += itemsInBlock.length
        }
      }
    }

    onProgress?.(Math.min(i + batchSize, totalBlocks), totalBlocks)
    // 批次间隔微延迟，让主线程与内核喘息
    await delay(50)
  }

  // 记录事务
  let transactionId: string | undefined
  if (transactionItems.length > 0) {
    const tx = await recordTransaction(query, replacement, transactionItems)
    transactionId = tx.id
  }

  return {
    success: true,
    totalCount: activeItems.length,
    replacedCount,
    skippedCount,
    transactionId,
  }
}
