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
  cancelled?: boolean
  transactionId?: string
  error?: string
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// 模块级取消标志：批量替换不可重入（VisualDiffModal 有 executing 门禁），
// Dock 销毁/插件卸载时通过 cancelActiveBatchReplace 请求中止当前批次
let batchReplaceCancelled = false

export function cancelActiveBatchReplace() {
  batchReplaceCancelled = true
}

/**
 * 针对纯文本在 DOM 节点中进行内容替换。
 *
 * 安全约束：
 * - 使用函数替换器，替换文本中的 $&/$'/$1 等特殊模式不会被二次解释
 * - 只替换位于文本内容（标签之外）的首个匹配，属性值中的出现一律跳过
 * - 找不到文本内容中的匹配时原样返回，由调用方计为跳过
 */
export function replaceTextInDom(domStr: string, originalText: string, newText: string): string {
  if (!domStr || !originalText) {
    return domStr ?? ''
  }

  let searchStart = 0
  while (searchStart <= domStr.length - originalText.length) {
    const index = domStr.indexOf(originalText, searchStart)
    if (index < 0) {
      return domStr
    }

    if (!isInsideTag(domStr, index)) {
      return domStr.slice(0, index) + newText + domStr.slice(index + originalText.length)
    }

    searchStart = index + 1
  }

  return domStr
}

function isInsideTag(dom: string, index: number) {
  const lastOpen = dom.lastIndexOf('<', index)
  if (lastOpen < 0) {
    return false
  }

  const lastClose = dom.lastIndexOf('>', index)
  return lastClose < lastOpen
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
  const progressCb = onProgress

  const activeItems: DiffItem[] = []
  for (const group of diffSummary.groups) {
    for (const item of group.items) {
      if (!item.excluded) {
        activeItems.push(item)
      }
    }
  }

  // 新批次启动时重置取消标志（上一批次可能已被中止）
  batchReplaceCancelled = false

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

  const isCancelled = () => batchReplaceCancelled

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
    if (isCancelled()) {
      return {
        success: false,
        cancelled: true,
        totalCount: activeItems.length,
        replacedCount,
        skippedCount: skippedCount + (activeItems.length - replacedCount - skippedCount),
      }
    }

    const chunk = allBlockIds.slice(i, i + batchSize)

    for (const blockId of chunk) {
      if (isCancelled()) {
        return {
          success: false,
          cancelled: true,
          totalCount: activeItems.length,
          replacedCount,
          skippedCount: skippedCount + (activeItems.length - replacedCount - skippedCount),
        }
      }

      const itemsInBlock = blockGroups.get(blockId) || []
      const originalDom = domMap[blockId]

      if (originalDom) {
        let updatedDom = originalDom
        const appliedItems: DiffItem[] = []

        // 逐条替换并按实际生效数计数：替换文本未命中（内容已被并发修改、
        // 仅出现在属性中等）时计为跳过，而不是盲目计入替换数
        for (const it of itemsInBlock) {
          const nextDom = replaceTextInDom(updatedDom, it.matchedText, it.replacedText)
          if (nextDom === updatedDom) {
            skippedCount += 1
            continue
          }

          updatedDom = nextDom
          appliedItems.push(it)
        }

        if (appliedItems.length === 0) {
          continue
        }

        try {
          await updateDomBlock(blockId, updatedDom)
          replacedCount += appliedItems.length

          for (const it of appliedItems) {
            transactionItems.push({
              blockId,
              rootId: it.rootId,
              docTitle: it.docTitle,
              hpath: it.hpath,
              blockType: it.blockType,
              originalSnippet: it.originalSnippet,
              prefixText: it.prefixText,
              matchedText: it.matchedText,
              replacedText: it.replacedText,
              suffixText: it.suffixText,
              fullContent: it.fullContent,
              newContent: it.newContent,
              originalDom,
              newDom: updatedDom,
            })
          }
        } catch {
          skippedCount += appliedItems.length
        }
      } else {
        // 拿不到原始 DOM 时无法安全替换：跳过该块。
        // 绝不允许用伪造的段落 DOM 覆盖块结构（会把代码块/表格等降级为段落，
        // 且伪造内容被记入事务后，回退会用它覆盖块的真实原始结构）。
        skippedCount += itemsInBlock.length
      }
    }

    progressCb?.(Math.min(i + batchSize, totalBlocks), totalBlocks)
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
