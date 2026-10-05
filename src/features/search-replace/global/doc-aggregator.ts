import type {
  DocAggregateNode,
  GlobalMatchSnippet,
  GlobalSearchSortMode,
  RawBlockRecord,
} from './types'
import {
  findAllPinyinMatches,
  matchFullPinyin,
  matchPinyinInitials,
} from './pinyin-match'

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
 * 清洗 Markdown 格式符号，还原为纯净文本
 */
export function cleanMarkdownFormatting(text: string): string {
  if (!text) return ''
  return text
    // 替换思源/Markdown超链接 [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // 替换图片 ![alt](url) -> [图片]
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // 替换思源块引用 ((id "anchor text")) -> anchor text
    .replace(/\(\([0-9a-z-]+\s+['"]([^'"]+)['"]\)\)/gi, '$1')
    // 替换思源普通块引用 ((id)) -> ''
    .replace(/\(\([0-9a-z-]+\)\)/gi, '')
    // 替换高亮标记 ==text== -> text
    .replace(/==([^=]+)==/g, '$1')
    // 替换加粗 **text** -> text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // 替换斜体 *text* -> text
    .replace(/\*([^*]+)\*/g, '$1')
    // 替换行内代码 `code` -> code
    .replace(/`([^`]+)`/g, '$1')
    // 替换删除线 ~~text~~ -> text
    .replace(/~~([^~]+)~~/g, '$1')
    // 去除 HTML 标签如 <u>, <mark>, <span> 等
    .replace(/<[^>]+>/g, '')
    .trim()
}

/**
 * 判断是否为表格对齐/分隔线行（如 |:---|:---:| 或 | ------| --------|）
 */
export function isTableSeparatorRow(rawLine: string): boolean {
  const trimmed = rawLine.trim()
  if (!trimmed) return false
  return /^\|?[\s:\-|]+\|?$/.test(trimmed) && trimmed.includes('-')
}

export interface ParsedTableRow {
  rowIndex: number
  lineText: string
  rawLine: string
  cells: string[]
}

/**
 * 解析表格块的行数据，分离表头与数据行，严格过滤 markdown 分隔线，并清洗 markdown 语法
 */
export function parseTableRowsFromBlock(block: RawBlockRecord): ParsedTableRow[] {
  const source = block.markdown?.trim() || block.fcontent?.trim() || block.content?.trim() || ''
  if (!source) return []

  const rawLines = source.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const rows: ParsedTableRow[] = []
  let currentRowIndex = 0

  for (const rawLine of rawLines) {
    if (isTableSeparatorRow(rawLine)) {
      continue
    }

    let line = rawLine
    if (line.startsWith('|')) line = line.slice(1)
    if (line.endsWith('|')) line = line.slice(0, -1)

    // 分割单元格并清洗各单元格的 markdown 标记
    const rawCells = line.split('|')
    const cleanCells = rawCells.map(c => cleanMarkdownFormatting(c.trim()))
    const formatted = cleanCells.join(' | ')

    if (formatted) {
      rows.push({
        rowIndex: currentRowIndex++,
        lineText: formatted,
        rawLine,
        cells: cleanCells,
      })
    }
  }

  return rows
}

/**
 * 为表格单行生成行内切片与高亮片段（严格限制在当前行内截取，绝不跨行）
 */
export function extractTableRowSnippet(
  lineText: string,
  matchesInLine: { start: number; end: number; text: string }[],
  maxLineLength = 80,
): {
  prefixText: string
  matchedText: string
  suffixText: string
  previewText: string
  segments: { text: string; isMatch: boolean }[]
} {
  if (!matchesInLine.length) {
    return {
      prefixText: '',
      matchedText: '',
      suffixText: '',
      previewText: lineText,
      segments: [{ text: lineText, isMatch: false }],
    }
  }

  const minStart = matchesInLine[0].start
  const maxEnd = matchesInLine[matchesInLine.length - 1].end

  let prefixStart = 0
  let suffixEnd = lineText.length
  let hasLeadingEllipsis = false
  let hasTrailingEllipsis = false

  if (lineText.length > maxLineLength) {
    const matchedSpan = maxEnd - minStart
    const surrounding = Math.max(16, Math.floor((maxLineLength - matchedSpan) / 2))
    prefixStart = Math.max(0, minStart - surrounding)
    suffixEnd = Math.min(lineText.length, maxEnd + surrounding)
    hasLeadingEllipsis = prefixStart > 0
    hasTrailingEllipsis = suffixEnd < lineText.length
  }

  const segments: { text: string; isMatch: boolean }[] = []
  let cur = prefixStart

  if (hasLeadingEllipsis) {
    segments.push({ text: '...', isMatch: false })
  }

  for (const lm of matchesInLine) {
    if (lm.start > cur) {
      segments.push({
        text: lineText.slice(cur, lm.start),
        isMatch: false,
      })
    }
    segments.push({
      text: lm.text,
      isMatch: true,
    })
    cur = lm.end
  }

  if (cur < suffixEnd) {
    segments.push({
      text: lineText.slice(cur, suffixEnd),
      isMatch: false,
    })
  }

  if (hasTrailingEllipsis) {
    segments.push({ text: '...', isMatch: false })
  }

  const previewText = segments.map(s => s.text).join('')
  const matchedText = matchesInLine.map(m => m.text).join(', ')

  return {
    prefixText: hasLeadingEllipsis ? '...' : '',
    matchedText,
    suffixText: hasTrailingEllipsis ? '...' : '',
    previewText,
    segments,
  }
}

/**
 * 针对表格块（type === 't'）按行检索并聚合生成各行的 MatchSnippet
 */
export function findMatchesInTableBlock(
  block: RawBlockRecord,
  query: string,
  options: {
    matchCase?: boolean
    wholeWord?: boolean
    useRegex?: boolean
    pinyin?: boolean
  } = {},
): GlobalMatchSnippet[] {
  const tableRows = parseTableRowsFromBlock(block)
  if (!tableRows.length) {
    return []
  }

  let regex: RegExp | null = null
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
    regex = null
  }

  const results: GlobalMatchSnippet[] = []

  for (const row of tableRows) {
    const lineText = row.lineText
    const lineMatches: { start: number; end: number; text: string }[] = []

    if (regex) {
      regex.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = regex.exec(lineText)) !== null) {
        if (match[0].length === 0) {
          regex.lastIndex++
          continue
        }
        lineMatches.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[0],
        })
      }
    }

    // 拼音搜索
    if (options.pinyin) {
      const pinyinMatches = findAllPinyinMatches(lineText, query)
      for (const pm of pinyinMatches) {
        const overlapped = lineMatches.some(m => !(pm.end <= m.start || pm.start >= m.end))
        if (!overlapped) {
          lineMatches.push({
            start: pm.start,
            end: pm.end,
            text: pm.matchedText,
          })
        }
      }
      lineMatches.sort((a, b) => a.start - b.start)
    }

    if (lineMatches.length > 0) {
      // 找出关键词命中了哪些单元格，提取第一个命中的单元格作为特征指纹
      const matchedCell = row.cells.find(cell => {
        if (!cell) return false
        if (regex) {
          regex.lastIndex = 0
          return regex.test(cell)
        }
        return cell.includes(query)
      }) || ''

      const snippet = extractTableRowSnippet(lineText, lineMatches)
      results.push({
        matchId: `${block.id}:tr:${row.rowIndex}`,
        blockId: block.id,
        rootId: block.root_id,
        blockType: block.type,
        subType: block.subtype || block.sub_type,
        matchedText: snippet.matchedText,
        prefixText: snippet.prefixText,
        suffixText: snippet.suffixText,
        previewText: snippet.previewText,
        segments: snippet.segments,
        fullContent: lineText,
        sort: block.sort ?? 0,
        updated: block.updated || '',
        created: block.created || '',
        hpath: block.hpath || '',
        box: block.box || '',
        selectedForReplace: true,
        startOffset: lineMatches[0].start,
        endOffset: lineMatches[lineMatches.length - 1].end,
        tableRowIndex: row.rowIndex,
        tableRowText: lineText,
        matchedCellText: matchedCell,
      })
    }
  }

  return results
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
    pinyin?: boolean
  } = {},
): GlobalMatchSnippet[] {
  // 如果是表格块，优先按表格行检索，展现同行的完整信息并支持定位具体行
  if (block.type === 't') {
    const tableMatches = findMatchesInTableBlock(block, query, options)
    if (tableMatches.length > 0) {
      return tableMatches
    }
  }

  let content = block.fcontent || block.content || ''
  if (!content && block.type === 'd' && block.hpath) {
    content = extractDocTitleFromHpath(block.hpath)
  }
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
      subType: block.subtype || block.sub_type,
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

  // 拼音首字母或全拼匹配
  if (options.pinyin) {
    const pinyinMatches = findAllPinyinMatches(content, query)
    for (const pm of pinyinMatches) {
      const { start, end, matchedText } = pm
      const overlapped = results.some(r => !(end <= r.startOffset || start >= r.endOffset))
      if (overlapped) continue

      const { prefixText, suffixText, previewText } = extractContextSnippet(
        content,
        start,
        end,
      )
      results.push({
        matchId: `${block.id}:${start}:py:${matchSeq++}`,
        blockId: block.id,
        rootId: block.root_id,
        blockType: block.type,
        subType: block.subtype || block.sub_type,
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
        startOffset: start,
        endOffset: end,
      })
    }
    results.sort((a, b) => a.startOffset - b.startOffset)
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
    pinyin?: boolean
    docOnly?: boolean
  } = {},
): DocAggregateNode[] {
  const targetBlocks = options.docOnly
    ? blocks.filter(b => b.type === 'd')
    : blocks

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
  for (const block of targetBlocks) {
    if (block.type === 'd' && block.id === block.root_id && block.content?.trim()) {
      docTitleOverrides.set(block.root_id, block.content.trim())
    }
  }

  for (const block of targetBlocks) {
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
