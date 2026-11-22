import type {
  DocAggregateNode,
  GlobalMatchSnippet,
} from './types'
import { t } from '@/i18n/runtime'

const BLOCK_PREVIEW_MAX_LENGTH = 36

function normalizeSingleLine(text: string): string {
  return text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function truncateBlockPreview(text: string, maxLength = BLOCK_PREVIEW_MAX_LENGTH): string {
  const normalized = normalizeSingleLine(text)
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, maxLength)}...`
}

function isDocMatch(match: GlobalMatchSnippet): boolean {
  return match.blockType === 'd' || match.blockType === 'doc'
}

function resolveMatchLabel(doc: DocAggregateNode, match: GlobalMatchSnippet): string {
  if (isDocMatch(match)) {
    return normalizeSingleLine(doc.docTitle)
  }
  const rawPreview = match.previewText || match.fullContent || doc.docTitle
  return truncateBlockPreview(rawPreview)
}

function sanitizeMarkdownLinkText(text: string): string {
  return text.replace(/\[/g, '\\[').replace(/\]/g, '\\]')
}

function sanitizeBlockRefAnchor(text: string): string {
  // 块引用外层使用单引号包裹 ((id 'anchor'))，内部单引号转为双引号避免提前闭合语法
  return text.replace(/'/g, '"')
}

function formatGroupedExport(
  docNodes: DocAggregateNode[],
  query: string | undefined,
  formatLine: (blockId: string, label: string) => string,
): string {
  const bodyLines: string[] = []
  let inFlatDocList = false

  for (const doc of docNodes) {
    if (!doc.matches.length) {
      continue
    }

    const isDocOnlyGroup = doc.matches.every(isDocMatch)
    if (isDocOnlyGroup) {
      for (const match of doc.matches) {
        const label = resolveMatchLabel(doc, match)
        bodyLines.push(`- ${formatLine(match.blockId, label)}`)
      }
      inFlatDocList = true
      continue
    }

    if (inFlatDocList && bodyLines.length > 0) {
      bodyLines.push('')
    }
    inFlatDocList = false

    bodyLines.push(`### ${normalizeSingleLine(doc.docTitle)}`)
    for (const match of doc.matches) {
      const label = resolveMatchLabel(doc, match)
      bodyLines.push(`- ${formatLine(match.blockId, label)}`)
    }
    bodyLines.push('')
  }

  const body = bodyLines.join('\n').trim()
  if (!body) {
    return ''
  }

  const normalizedQuery = query ? normalizeSingleLine(query) : ''
  if (!normalizedQuery) {
    return body
  }

  return `${t('globalExportSearchHeader', { query: normalizedQuery })}\n\n${body}`
}

/**
 * 导出为 Markdown 双链列表
 */
export function exportAsMarkdownLinks(docNodes: DocAggregateNode[], query?: string): string {
  return formatGroupedExport(docNodes, query, (blockId, label) => (
    `[${sanitizeMarkdownLinkText(label)}](siyuan://blocks/${blockId})`
  ))
}

/**
 * 导出为思源块引用列表 ((block_id '锚文本'))
 */
export function exportAsBlockRefs(docNodes: DocAggregateNode[], query?: string): string {
  return formatGroupedExport(docNodes, query, (blockId, label) => (
    `((${blockId} '${sanitizeBlockRefAnchor(label)}'))`
  ))
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
