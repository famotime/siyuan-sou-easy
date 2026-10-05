import type {
  DocAggregateNode,
  GlobalMatchSnippet,
  GlobalSearchSortMode,
  RawBlockRecord,
} from './types'

const PUNCTUATION_REGEX = /[。！？!?；;\n]/

/**
 * 提取上下文切片
 */
export function extractContextSnippet(
  fullText: string,
  startOffset: number,
  endOffset: number,
  maxSurrounding = 40,
): {
  prefixText: string
  matchedText: string
  suffixText: string
  previewText: string
} {
  const matchedText = fullText.slice(startOffset, endOffset)

  const prefixStart = Math.max(0, startOffset - maxSurrounding)
  let prefixText = fullText.slice(prefixStart, startOffset)
  if (prefixStart > 0) {
    prefixText = `...${prefixText}`
  }

  const suffixEnd = Math.min(fullText.length, endOffset + maxSurrounding)
  let suffixText = fullText.slice(endOffset, suffixEnd)
  if (suffixEnd < fullText.length) {
    suffixText = `${suffixText}...`
  }

  const previewText = `${prefixText}${matchedText}${suffixText}`

  return {
    prefixText,
    matchedText,
    suffixText,
    previewText,
  }
}

/**
 * 从 hpath 提取可读文档标题
 * 例如 "/知识库/日记/2026-10-05" -> "2026-10-05"
 */
export function extractDocTitleFromHpath(hpath: string): string {
  if (!hpath) {
    return '未命名文档'
  }
  const normalized = hpath.replace(/\/+$/, '')
  const lastSlash = normalized.lastIndexOf('/')
  if (lastSlash >= 0) {
    const title = normalized.slice(lastSlash + 1).trim()
    return title || '根目录'
  }
  return normalized || '未命名文档'
}

/**
 * 在块文本中寻找所有匹配，并转换为 MatchSnippet 列表
 */
export function findMatchesInBlock(
  block: RawBlockRecord,
  query: string,
  options: {
    matchCase?: boolean
    wholeWord?: boolean
    useRegex?: boolean
  } = {},
): GlobalMatchSnippet[] {
  const content = block.fcontent || block.content || ''
  if (!content || !query) {
    return []
  }

  const results: GlobalMatchSnippet[] = []

  let regex: RegExp
  try {
    if (options.useRegex) {
      regex = new RegExp(query, options.matchCase ? 'g' : 'gi')
    } else {
      let escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (options.wholeWord) {
        escaped = `\\b${escaped}\\b`
      }
      regex = new RegExp(escaped, options.matchCase ? 'g' : 'gi')
    }
  } catch {
    return []
  }

  let match: RegExpExecArray | null
  let matchSeq = 0

  while ((match = regex.exec(content)) !== null) {
    if (match[0].length === 0) {
      regex.lastIndex++
      continue
    }

    const startOffset = match.index
    const endOffset = startOffset + match[0].length
    const { prefixText, matchedText, suffixText, previewText } = extractContextSnippet(
      content,
      startOffset,
      endOffset,
    )

    results.push({
      matchId: `${block.id}:${startOffset}:${matchSeq++}`,
      blockId: block.id,
      rootId: block.root_id,
      blockType: block.type,
      subType: block.sub_type,
      matchedText,
      prefixText,
      suffixText,
      previewText,
      segments: [
        { text: prefixText, isMatch: false },
        { text: matchedText, isMatch: true },
        { text: suffixText, isMatch: false },
      ],
      fullContent: content,
      sort: block.sort ?? 0,
      updated: block.updated || '',
      created: block.created || '',
      hpath: block.hpath || '',
      box: block.box || '',
      selectedForReplace: true,
      startOffset,
      endOffset,
    })
  }

  return results
}

/**
 * 将平铺的块记录按 root_id 聚合为文档维度的树状节点
 */
export function aggregateBlocksToDocs(
  blocks: RawBlockRecord[],
  query: string,
  options: {
    matchCase?: boolean
    wholeWord?: boolean
    useRegex?: boolean
  } = {},
): DocAggregateNode[] {
  const docMap = new Map<string, {
    rootId: string
    boxId: string
    hpath: string
    docTitle: string
    updated: string
    created: string
    matches: GlobalMatchSnippet[]
  }>()

  // 首先识别是否有文档根块自身
  const docTitleOverrides = new Map<string, string>()
  for (const block of blocks) {
    if (block.type === 'd' && block.id === block.root_id && block.content?.trim()) {
      docTitleOverrides.set(block.root_id, block.content.trim())
    }
  }

  for (const block of blocks) {
    const matches = findMatchesInBlock(block, query, options)
    if (!matches.length) {
      continue
    }

    let doc = docMap.get(block.root_id)
    if (!doc) {
      const title = docTitleOverrides.get(block.root_id) || extractDocTitleFromHpath(block.hpath)
      doc = {
        rootId: block.root_id,
        boxId: block.box,
        hpath: block.hpath,
        docTitle: title,
        updated: block.updated || '',
        created: block.created || '',
        matches: [],
      }
      docMap.set(block.root_id, doc)
    }

    doc.matches.push(...matches)
    if (block.updated && block.updated > doc.updated) {
      doc.updated = block.updated
    }
  }

  const nodes: DocAggregateNode[] = []
  for (const item of docMap.values()) {
    // 块内部按 reading order (sort) 排序
    item.matches.sort((a, b) => a.sort - b.sort || a.startOffset - b.startOffset)
    nodes.push({
      ...item,
      collapsed: false,
      totalCount: item.matches.length,
    })
  }

  return nodes
}

/**
 * 对 Doc-First 聚合节点进行多维排序
 */
export function sortDocAggregateNodes(
  nodes: DocAggregateNode[],
  sortMode: GlobalSearchSortMode,
  query?: string,
): DocAggregateNode[] {
  const sorted = [...nodes]

  switch (sortMode) {
    case 'updatedDesc':
      sorted.sort((a, b) => b.updated.localeCompare(a.updated))
      break

    case 'createdDesc':
      sorted.sort((a, b) => b.created.localeCompare(a.created))
      break

    case 'readingOrder':
      sorted.sort((a, b) => a.hpath.localeCompare(b.hpath))
      break

    case 'relevance':
    default: {
      const q = (query || '').toLowerCase()
      sorted.sort((a, b) => {
        // 标题命中加分
        const aTitleMatch = q && a.docTitle.toLowerCase().includes(q) ? 50 : 0
        const bTitleMatch = q && b.docTitle.toLowerCase().includes(q) ? 50 : 0
        const aScore = aTitleMatch + a.totalCount
        const bScore = bTitleMatch + b.totalCount
        if (bScore !== aScore) {
          return bScore - aScore
        }
        return b.updated.localeCompare(a.updated)
      })
      break
    }
  }

  return sorted
}
