import { showMessage } from 'siyuan'
import { t } from '@/i18n/runtime'
import { querySql } from '../kernel'
import { searchReplaceState } from './state'

// 拆分自 store.ts（RF-108）：全库命中结果的批量提取（复制 Markdown / 块引用）。
// 注意：本模块的块引用锚文本规则（previewText 截断 30 字符 + 双引号转义）与
// global/export-utils.ts 的 exportAsBlockRefs（matchedText + 单引号）刻意不同，不要合并。

export async function extractAll() {
  if (searchReplaceState.sourceMode === 'terminal' || !searchReplaceState.matches.length) {
    return
  }

  const uniqueBlockIds = Array.from(new Set(searchReplaceState.matches.map((m) => m.blockId)))

  const limit = 1000
  const isLimited = uniqueBlockIds.length > limit
  const targetIds = uniqueBlockIds.slice(0, limit)
  let resultText = ''

  if (searchReplaceState.settings.extractAsBlockRef) {
    const textLimit = 30
    const matchByBlockId = new Map(searchReplaceState.matches.map((m) => [m.blockId, m]))
    resultText = targetIds.map((id) => {
      const match = matchByBlockId.get(id)
      let anchorText = match?.previewText?.trim() || ''
      if (match?.matchedText) {
        anchorText = anchorText.replace(`[${match.matchedText}]`, match.matchedText)
      }
      if (anchorText.length > textLimit) {
        anchorText = `${anchorText.substring(0, textLimit)}...`
      }
      anchorText = anchorText.replace(/"/g, "'").replace(/[\r\n]+/g, ' ') // Prevent breaking syntax
      return `* ((${id} "${anchorText}"))`
    }).join('\n')
  } else {
    try {
      // Build a SQL query to get markdown for all targeted blocks
      const idListStr = targetIds.map((id) => `'${id}'`).join(',')
      const results = await querySql(`SELECT id, markdown FROM blocks WHERE id IN (${idListStr})`)
      const markdownMap = new Map<string, string>()
      for (const row of results) {
        if (row?.id && typeof row.markdown === 'string') {
          markdownMap.set(row.id, row.markdown)
        }
      }
      resultText = targetIds
        .map((id) => markdownMap.get(id))
        .filter((md): md is string => typeof md === 'string')
        .join('\n\n')
    } catch (e) {
      console.error('Failed to extract plain text', e)
      showMessage(t('extractFailed'), 3000, 'error')
      return
    }
  }

  try {
    await navigator.clipboard.writeText(resultText)
    if (isLimited) {
      showMessage(t('extractLimitWarning', { 0: String(limit) }), 5000, 'info')
    } else {
      showMessage(t('extractSuccess', { 0: String(targetIds.length) }), 3000, 'info')
    }
  } catch (e) {
    console.error('Clipboard write failed', e)
  }
}
