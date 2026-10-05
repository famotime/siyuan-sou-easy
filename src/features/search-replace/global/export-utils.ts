import type { DocAggregateNode } from './types'

/**
 * 导出为 Markdown 双链列表
 */
export function exportAsMarkdownLinks(docNodes: DocAggregateNode[]): string {
  const lines: string[] = []

  for (const doc of docNodes) {
    lines.push(`### ${doc.docTitle}`)
    for (const match of doc.matches) {
      lines.push(`- [${doc.docTitle}](siyuan://blocks/${match.blockId}) : ${match.previewText}`)
    }
    lines.push('')
  }

  return lines.join('\n').trim()
}

/**
 * 导出为思源块引用列表 ((block_id '锚文本'))
 */
export function exportAsBlockRefs(docNodes: DocAggregateNode[]): string {
  const lines: string[] = []

  for (const doc of docNodes) {
    lines.push(`### ${doc.docTitle}`)
    for (const match of doc.matches) {
      lines.push(`- ((${match.blockId} '${match.matchedText}')) : ${match.previewText}`)
    }
    lines.push('')
  }

  return lines.join('\n').trim()
}

/**
 * 导出为思源 SQL 嵌入块
 */
export function exportAsEmbedQuery(docNodes: DocAggregateNode[]): string {
  const blockIds: string[] = []
  for (const doc of docNodes) {
    for (const match of doc.matches) {
      blockIds.push(`'${match.blockId}'`)
    }
  }

  if (blockIds.length === 0) {
    return '{{select * from blocks where 1=0}}'
  }

  return `{{select * from blocks where id in (${blockIds.join(', ')})}}`
}

/**
 * 复制文本到系统剪贴板
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch (err) {
    console.warn('Clipboard writeText failed:', err)
  }

  // 回退方式
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    return true
  } catch {
    return false
  }
}
