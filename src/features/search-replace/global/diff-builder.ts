import type {
  DocAggregateNode,
  GlobalMatchSnippet,
} from './types'
import { extractContextSnippet } from './doc-aggregator'

export interface DiffItem {
  matchId: string
  blockId: string
  rootId: string
  docTitle: string
  hpath: string
  blockType: string
  originalSnippet: string
  prefixText: string
  matchedText: string
  replacedText: string
  suffixText: string
  fullContent: string
  newContent: string
  excluded: boolean
  startOffset: number
  endOffset: number
}

export interface DiffDocumentGroup {
  rootId: string
  docTitle: string
  hpath: string
  items: DiffItem[]
  allExcluded: boolean
  collapsed?: boolean
}

export interface DiffSummary {
  totalCount: number
  includedCount: number
  excludedCount: number
  affectedDocCount: number
  groups: DiffDocumentGroup[]
}

export interface VisualDiffOptions {
  useRegex?: boolean
  preserveCase?: boolean
  matchCase?: boolean
  wholeWord?: boolean
  query?: string
}

/**
 * 计算单个命中项替换后的文本
 */
export function computeReplacement(
  matchedText: string,
  replacement: string,
  options: VisualDiffOptions = {},
): string {
  let result = replacement

  // 正则捕获组反向引用支持 ($1, $2 等)
  if (options.useRegex && options.query) {
    try {
      const flags = options.matchCase ? '' : 'i'
      const reg = new RegExp(options.query, flags)
      result = matchedText.replace(reg, replacement)
    } catch {
      result = replacement
    }
  }

  // 如果启用大小写保持
  if (options.preserveCase) {
    if (matchedText === matchedText.toUpperCase()) {
      result = result.toUpperCase()
    } else if (matchedText === matchedText.toLowerCase()) {
      result = result.toLowerCase()
    } else if (
      matchedText.length > 0
      && matchedText[0] === matchedText[0].toUpperCase()
      && matchedText.slice(1) === matchedText.slice(1).toLowerCase()
    ) {
      result = result.charAt(0).toUpperCase() + result.slice(1).toLowerCase()
    }
  }

  return result
}

/**
 * 根据全库匹配结果生成 Visual Diff 比较树
 */
export function buildVisualDiff(
  docNodes: DocAggregateNode[],
  replacement: string,
  options?: VisualDiffOptions,
): DiffSummary
export function buildVisualDiff(
  docNodes: DocAggregateNode[],
  query: string,
  replacement: string,
  options?: VisualDiffOptions,
): DiffSummary
export function buildVisualDiff(
  docNodes: DocAggregateNode[],
  arg2: string,
  arg3?: string | VisualDiffOptions,
  arg4?: VisualDiffOptions,
): DiffSummary {
  let query: string | undefined
  let replacement: string
  let options: VisualDiffOptions

  if (typeof arg3 === 'string') {
    query = arg2
    replacement = arg3
    options = arg4 || {}
  } else {
    replacement = arg2
    options = arg3 || {}
    query = options.query
  }

  const effectiveOptions: VisualDiffOptions = {
    ...options,
    query: options.query ?? query,
  }
  const groups: DiffDocumentGroup[] = []
  let totalCount = 0
  let includedCount = 0
  let excludedCount = 0

  for (const doc of docNodes) {
    const items: DiffItem[] = []

    for (const match of doc.matches) {
      const occurrences = match.occurrences && match.occurrences.length > 0
        ? match.occurrences
        : [{ start: match.startOffset, end: match.endOffset, text: match.matchedText }]

      for (let occIdx = 0; occIdx < occurrences.length; occIdx++) {
        const occ = occurrences[occIdx]
        const replacedText = computeReplacement(occ.text, replacement, effectiveOptions)
        const full = match.fullContent
        const newContent = `${full.slice(0, occ.start)}${replacedText}${full.slice(occ.end)}`
        const isExcluded = !match.selectedForReplace

        totalCount++
        if (isExcluded) {
          excludedCount++
        } else {
          includedCount++
        }

        const snippet = extractContextSnippet(full, occ.start, occ.end)

        items.push({
          matchId: occurrences.length > 1 ? `${match.matchId}:${occ.start}:${occIdx}` : match.matchId,
          blockId: match.blockId,
          rootId: match.rootId,
          docTitle: doc.docTitle,
          hpath: doc.hpath,
          blockType: match.blockType,
          originalSnippet: snippet.previewText,
          prefixText: snippet.prefixText,
          matchedText: occ.text,
          replacedText,
          suffixText: snippet.suffixText,
          fullContent: match.fullContent,
          newContent,
          excluded: isExcluded,
          startOffset: occ.start,
          endOffset: occ.end,
        })
      }
    }

    if (items.length > 0) {
      groups.push({
        rootId: doc.rootId,
        docTitle: doc.docTitle,
        hpath: doc.hpath,
        items,
        allExcluded: items.every(i => i.excluded),
        collapsed: false,
      })
    }
  }

  return {
    totalCount,
    includedCount,
    excludedCount,
    affectedDocCount: groups.filter(g => g.items.some(i => !i.excluded)).length,
    groups,
  }
}
