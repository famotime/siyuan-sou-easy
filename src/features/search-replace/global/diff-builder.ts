import type {
  DocAggregateNode,
  GlobalMatchSnippet,
} from './types'

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
}

export interface DiffSummary {
  totalCount: number
  includedCount: number
  excludedCount: number
  affectedDocCount: number
  groups: DiffDocumentGroup[]
}

/**
 * 计算单个命中项替换后的文本
 */
export function computeReplacement(
  matchedText: string,
  replacement: string,
  options: {
    useRegex?: boolean
    preserveCase?: boolean
  } = {},
): string {
  // 基础替换内容
  let result = replacement

  // 如果启用大小写保持
  if (options.preserveCase) {
    if (matchedText === matchedText.toUpperCase()) {
      result = replacement.toUpperCase()
    } else if (matchedText === matchedText.toLowerCase()) {
      result = replacement.toLowerCase()
    } else if (
      matchedText.length > 0
      && matchedText[0] === matchedText[0].toUpperCase()
      && matchedText.slice(1) === matchedText.slice(1).toLowerCase()
    ) {
      result = replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase()
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
  options: {
    useRegex?: boolean
    preserveCase?: boolean
  } = {},
): DiffSummary {
  const groups: DiffDocumentGroup[] = []
  let totalCount = 0
  let includedCount = 0
  let excludedCount = 0

  for (const doc of docNodes) {
    const items: DiffItem[] = []

    for (const match of doc.matches) {
      const replacedText = computeReplacement(match.matchedText, replacement, options)
      const full = match.fullContent
      const newContent = `${full.slice(0, match.startOffset)}${replacedText}${full.slice(match.endOffset)}`
      const isExcluded = !match.selectedForReplace

      totalCount++
      if (isExcluded) {
        excludedCount++
      } else {
        includedCount++
      }

      items.push({
        matchId: match.matchId,
        blockId: match.blockId,
        rootId: match.rootId,
        docTitle: doc.docTitle,
        hpath: doc.hpath,
        blockType: match.blockType,
        originalSnippet: match.previewText,
        prefixText: match.prefixText,
        matchedText: match.matchedText,
        replacedText,
        suffixText: match.suffixText,
        fullContent: match.fullContent,
        newContent,
        excluded: isExcluded,
        startOffset: match.startOffset,
        endOffset: match.endOffset,
      })
    }

    if (items.length > 0) {
      groups.push({
        rootId: doc.rootId,
        docTitle: doc.docTitle,
        hpath: doc.hpath,
        items,
        allExcluded: items.every(i => i.excluded),
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
