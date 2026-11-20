import type {
  ContextSnippetSegment,
  DocAggregateNode,
  GlobalMatchSnippet,
  GlobalSearchSortMode,
  MatchOccurrence,
  ParsedGlobalQuery,
  RawBlockRecord,
} from './types'
import {
  findAllPinyinMatches,
} from './pinyin-match'

export interface AggregateBlocksOptions {
  matchCase?: boolean
  wholeWord?: boolean
  useRegex?: boolean
  pinyin?: boolean
  docOnly?: boolean
  parsedQuery?: ParsedGlobalQuery
}

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
  return /^[\s:\-|]+$/.test(trimmed) && trimmed.includes('-')
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

  const rawLines = source.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
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
    const cleanCells = rawCells.map((c) => cleanMarkdownFormatting(c.trim()))
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
 * 提取多处关键词命中的上下文切片与高亮片段（支持同一块/行内多次匹配同时高亮，并智能居中截取）
 */
export function extractMultiMatchSnippet(
  fullText: string,
  matches: MatchOccurrence[],
  maxLength = 80,
): {
  prefixText: string
  matchedText: string
  suffixText: string
  previewText: string
  segments: ContextSnippetSegment[]
} {
  if (!matches.length) {
    return {
      prefixText: '',
      matchedText: '',
      suffixText: '',
      previewText: fullText,
      segments: [{
        text: fullText,
        isMatch: false,
      }],
    }
  }

  const minStart = matches[0].start
  const maxEnd = matches[matches.length - 1].end

  let prefixStart = 0
  let suffixEnd = fullText.length
  let hasLeadingEllipsis = false
  let hasTrailingEllipsis = false

  if (fullText.length > maxLength) {
    const matchedSpan = maxEnd - minStart
    const surrounding = Math.max(16, Math.floor((maxLength - matchedSpan) / 2))
    prefixStart = Math.max(0, minStart - surrounding)
    suffixEnd = Math.min(fullText.length, maxEnd + surrounding)
    hasLeadingEllipsis = prefixStart > 0
    hasTrailingEllipsis = suffixEnd < fullText.length
  }

  const segments: ContextSnippetSegment[] = []
  let cur = prefixStart

  if (hasLeadingEllipsis) {
    segments.push({
      text: '...',
      isMatch: false,
    })
  }

  for (const lm of matches) {
    if (lm.start > cur) {
      segments.push({
        text: fullText.slice(cur, lm.start),
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
      text: fullText.slice(cur, suffixEnd),
      isMatch: false,
    })
  }

  if (hasTrailingEllipsis) {
    segments.push({
      text: '...',
      isMatch: false,
    })
  }

  const previewText = segments.map((s) => s.text).join('')
  const matchedText = matches.map((m) => m.text).join(', ')

  return {
    prefixText: hasLeadingEllipsis ? '...' : '',
    matchedText,
    suffixText: hasTrailingEllipsis ? '...' : '',
    previewText,
    segments,
  }
}

/**
 * 为表格单行生成行内切片与高亮片段（严格限制在当前行内截取，绝不跨行）
 */
export function extractTableRowSnippet(
  lineText: string,
  matchesInLine: MatchOccurrence[],
  maxLineLength = 80,
) {
  return extractMultiMatchSnippet(lineText, matchesInLine, maxLineLength)
}

/**
 * 校验文本是否包含特定词（支持区分大小写）
 */
function containsNegativeTerm(text: string, term: string, matchCase = false): boolean {
  if (!text || !term) return false
  if (matchCase) {
    return text.includes(term)
  }
  return text.toLowerCase().includes(term.toLowerCase())
}

/**
 * 提取待检索的关键词列表（parsedQuery 多词模式或单查询词，去重去空）
 */
function resolveTargetTerms(query: string, options: AggregateBlocksOptions): string[] {
  const parsed = options.parsedQuery
  return parsed
    ? Array.from(new Set([...(parsed.mustInclude || []), ...(parsed.orGroups?.flat() || [])])).filter(Boolean)
    : [query].filter(Boolean)
}

/**
 * 编译单个目标词的匹配正则（转义/wholeWord/matchCase 逻辑与历史行为完全一致；无效正则返回 null）
 */
function compileTermRegex(term: string, options: AggregateBlocksOptions): RegExp | null {
  try {
    if (options.useRegex) {
      return new RegExp(term, options.matchCase ? 'g' : 'gi')
    }
    let escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (options.wholeWord) {
      escaped = `\\b${escaped}\\b`
    }
    return new RegExp(escaped, options.matchCase ? 'g' : 'gi')
  } catch {
    return null
  }
}

export type CompiledTermRegexMap = Map<string, RegExp | null>

/**
 * 按目标词批量预编译匹配正则（词 -> 正则或 null），避免在逐块/逐行/逐单元格循环内反复编译
 */
function compileTermRegexes(terms: string[], options: AggregateBlocksOptions): CompiledTermRegexMap {
  const map: CompiledTermRegexMap = new Map()
  for (const term of terms) {
    if (term && !map.has(term)) {
      map.set(term, compileTermRegex(term, options))
    }
  }
  return map
}

/**
 * 从文本中收集各目标词的所有匹配 Occurrence 与命中的词集合
 * compiledRegexes：可选的预编译正则表（键为 targetTerms）；未提供时按需即时编译，行为一致
 */
function collectOccurrencesForTerms(
  content: string,
  terms: string[],
  options: AggregateBlocksOptions = {},
  compiledRegexes?: CompiledTermRegexMap,
): {
  occurrences: MatchOccurrence[]
  matchedTerms: Set<string>
} {
  const allMatches: MatchOccurrence[] = []
  const matchedTerms = new Set<string>()

  for (const term of terms) {
    if (!term) continue
    const regex = compiledRegexes?.get(term) ?? compileTermRegex(term, options)

    let termMatched = false

    if (regex) {
      regex.lastIndex = 0
      for (let m = regex.exec(content); m !== null; m = regex.exec(content)) {
        if (m[0].length === 0) {
          regex.lastIndex++
          continue
        }
        termMatched = true
        allMatches.push({
          start: m.index,
          end: m.index + m[0].length,
          text: m[0],
        })
      }
    }

    // 拼音搜索
    if (options.pinyin) {
      const pinyinMatches = findAllPinyinMatches(content, term)
      if (pinyinMatches.length > 0) {
        termMatched = true
        for (const pm of pinyinMatches) {
          const overlapped = allMatches.some((r) => !(pm.end <= r.start || pm.start >= r.end))
          if (!overlapped) {
            allMatches.push({
              start: pm.start,
              end: pm.end,
              text: pm.matchedText,
            })
          }
        }
      }
    }

    if (termMatched) {
      matchedTerms.add(term)
    }
  }

  // 按起始偏移升序并消除重叠区间
  allMatches.sort((a, b) => a.start - b.start)
  const deduped: MatchOccurrence[] = []
  for (const occ of allMatches) {
    if (!deduped.length) {
      deduped.push(occ)
      continue
    }
    const last = deduped[deduped.length - 1]
    if (occ.start >= last.end) {
      deduped.push(occ)
    }
  }

  return {
    occurrences: deduped,
    matchedTerms,
  }
}

/**
 * 判定单块（或单行）是否已包含全部必需关键词并满足全部 OR 组
 * （RF-111：原在 findMatchesInTableBlock 与 findMatchesInBlock 中逐字重复）
 */
function isFullMultiTermMatch(
  matchedTerms: Set<string>,
  mustInclude: string[],
  orGroups: string[][],
) {
  return mustInclude.length > 0
    && mustInclude.every((t) => matchedTerms.has(t))
    && (orGroups.length === 0 || orGroups.every((g) => g.some((t) => matchedTerms.has(t))))
}

interface GlobalMatchSnippetCore {
  matchedText: string
  prefixText: string
  suffixText: string
  previewText: string
  segments: ContextSnippetSegment[]
}

interface GlobalMatchSnippetTableExtras {
  matchedCellText?: string
  tableRowIndex?: number
  tableRowText?: string
}

/**
 * 组装 GlobalMatchSnippet 的公共字段（RF-111：表格/普通块两份 20+ 字段构造收敛，
 * 表格路径通过 extras 追加行定位字段，普通块路径不含这些键）
 */
function buildGlobalMatchSnippet(
  block: RawBlockRecord,
  core: GlobalMatchSnippetCore,
  occurrences: MatchOccurrence[],
  isFullMatch: boolean,
  matchId: string,
  fullContent: string,
  extras?: GlobalMatchSnippetTableExtras,
): GlobalMatchSnippet {
  return {
    matchId,
    blockId: block.id,
    rootId: block.root_id,
    blockType: block.type,
    subType: block.subtype,
    matchedText: core.matchedText,
    prefixText: core.prefixText,
    suffixText: core.suffixText,
    previewText: core.previewText,
    segments: core.segments,
    fullContent,
    sort: block.sort ?? 0,
    updated: block.updated || '',
    created: block.created || '',
    hpath: block.hpath || '',
    box: block.box || '',
    selectedForReplace: true,
    startOffset: occurrences[0].start,
    endOffset: occurrences[occurrences.length - 1].end,
    occurrences,
    isFullBlockMatch: isFullMatch,
    ...(extras?.tableRowIndex !== undefined || extras?.tableRowText !== undefined || extras?.matchedCellText !== undefined
      ? {
          matchedCellText: extras?.matchedCellText,
          tableRowIndex: extras?.tableRowIndex,
          tableRowText: extras?.tableRowText,
        }
      : {}),
  }
}

/**
 * 针对表格块（type === 't'）按行检索并聚合生成各行的 MatchSnippet
 * compiledRegexes：可选的预编译正则表（由 aggregateBlocksToDocs 入口一次编译传入）；未提供时在函数入口编译一次
 */
export function findMatchesInTableBlock(
  block: RawBlockRecord,
  query: string,
  options: AggregateBlocksOptions = {},
  compiledRegexes?: CompiledTermRegexMap,
): GlobalMatchSnippet[] {
  const tableRows = parseTableRowsFromBlock(block)
  if (!tableRows.length) {
    return []
  }

  // 提取待检索的关键词列表
  const targetTerms = resolveTargetTerms(query, options)

  if (!targetTerms.length) {
    return []
  }

  const parsed = options.parsedQuery
  const excludeTerms = parsed?.exclude || []
  const mustInclude = parsed?.mustInclude || []
  const orGroups = parsed?.orGroups || []

  // 行×单元格×词三层循环外一次性预编译，替代循环内逐次 new RegExp
  const regexMap = compiledRegexes ?? compileTermRegexes(targetTerms, options)

  const results: GlobalMatchSnippet[] = []

  for (const row of tableRows) {
    const lineText = row.lineText

    // 排除词过滤：行内包含任一排除词则忽略此行
    if (excludeTerms.some((ex) => containsNegativeTerm(lineText, ex, options.matchCase))) {
      continue
    }

    const {
      occurrences,
      matchedTerms,
    } = collectOccurrencesForTerms(lineText, targetTerms, options, regexMap)
    if (!occurrences.length) {
      continue
    }

    // 检查此表格单行是否达到“同块/同行完全包含”
    const isFullMatch = isFullMultiTermMatch(matchedTerms, mustInclude, orGroups)

    // 找出关键词命中了哪些单元格，提取第一个命中的单元格作为特征指纹
    const matchedCell = row.cells.find((cell) => {
      if (!cell) return false
      return targetTerms.some((term) => {
        if (options.useRegex) {
          const regex = regexMap.get(term)
          // null 为无效正则（与历史 catch 分支一致）；复用前必须重置 lastIndex 以等价于历史“每次新建正则”语义
          if (!regex) return false
          regex.lastIndex = 0
          return regex.test(cell)
        }
        return cell.includes(term)
      })
    }) || ''

    const snippet = extractTableRowSnippet(lineText, occurrences)
    results.push(buildGlobalMatchSnippet(
      block,
      snippet,
      occurrences,
      isFullMatch,
      `${block.id}:tr:${row.rowIndex}`,
      lineText,
      {
        matchedCellText: matchedCell,
        tableRowIndex: row.rowIndex,
        tableRowText: lineText,
      },
    ))
  }

  return results
}

/**
 * 在块文本中寻找匹配，按块合并展示为单一 MatchSnippet（包含块内所有高亮片段）
 * compiledRegexes：可选的预编译正则表（由 aggregateBlocksToDocs 入口一次编译传入）；未提供时按需在本次调用内编译一次
 */
export function findMatchesInBlock(
  block: RawBlockRecord,
  query: string,
  options: AggregateBlocksOptions = {},
  compiledRegexes?: CompiledTermRegexMap,
): GlobalMatchSnippet[] {
  // 如果是表格块，优先按表格行检索，展现同行的完整信息并支持定位具体行
  if (block.type === 't') {
    const tableMatches = findMatchesInTableBlock(block, query, options, compiledRegexes)
    if (tableMatches.length > 0) {
      return tableMatches
    }
  }

  let content = block.fcontent || block.content || ''
  if (!content && block.type === 'd' && block.hpath) {
    content = extractDocTitleFromHpath(block.hpath)
  }
  if (!content) {
    return []
  }

  const targetTerms = resolveTargetTerms(query, options)

  if (!targetTerms.length) {
    return []
  }

  const parsed = options.parsedQuery
  const excludeTerms = parsed?.exclude || []
  const mustInclude = parsed?.mustInclude || []
  const orGroups = parsed?.orGroups || []

  // 排除词过滤：块内包含任一排除词则直接排除
  if (excludeTerms.some((ex) => containsNegativeTerm(content, ex, options.matchCase))) {
    return []
  }

  const regexMap = compiledRegexes ?? compileTermRegexes(targetTerms, options)
  const {
    occurrences,
    matchedTerms,
  } = collectOccurrencesForTerms(content, targetTerms, options, regexMap)
  if (!occurrences.length) {
    return []
  }

  // 判定是否单块全包含所有必需关键词
  const isFullMatch = isFullMultiTermMatch(matchedTerms, mustInclude, orGroups)

  const snippet = extractMultiMatchSnippet(content, occurrences)

  return [buildGlobalMatchSnippet(
    block,
    snippet,
    occurrences,
    isFullMatch,
    `${block.id}:${occurrences[0].start}`,
    content,
  )]
}

/**
 * 将平铺的块记录按 root_id 聚合为文档维度的树状节点，并支持智能双层匹配
 */
export function aggregateBlocksToDocs(
  blocks: RawBlockRecord[],
  query: string,
  options: AggregateBlocksOptions = {},
): DocAggregateNode[] {
  const targetBlocks = options.docOnly
    ? blocks.filter((b) => b.type === 'd')
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

  const seenBlockIds = new Set<string>()

  // 全量聚合只编译一次匹配正则（含 useRegex/wholeWord/matchCase 分支），逐块复用；拼音路径不依赖正则，不受影响
  const compiledRegexes = compileTermRegexes(resolveTargetTerms(query, options), options)

  for (const block of targetBlocks) {
    if (seenBlockIds.has(block.id)) {
      continue
    }
    // 处理前先登记：无命中的重复块不再重复执行匹配（同一块内容相同，结果不变）
    seenBlockIds.add(block.id)
    const matches = findMatchesInBlock(block, query, options, compiledRegexes)
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

  const parsed = options.parsedQuery
  const excludeTerms = parsed?.exclude || []
  const mustInclude = parsed?.mustInclude || []
  const orGroups = parsed?.orGroups || []
  const isMultiTerm = Boolean(parsed?.isMultiTermQuery)

  const nodes: DocAggregateNode[] = []

  for (const item of docMap.values()) {
    // 1. 文档级排除词检查：文档标题若包含排除词，则直接剔除整篇文档
    if (excludeTerms.some((ex) => containsNegativeTerm(item.docTitle, ex, options.matchCase))) {
      continue
    }

    // 2. 智能双层匹配校验（RF-111：抽 verifyCrossBlockMatch）
    const verified = isMultiTerm
      ? verifyCrossBlockMatch(item.matches, mustInclude, orGroups)
      : 'exact-block'
    if (verified === 'drop') {
      continue
    }

    // 块内部按 reading order (sort) 排序
    item.matches.sort((a, b) => a.sort - b.sort || a.startOffset - b.startOffset)

    nodes.push({
      ...item,
      collapsed: false,
      totalCount: item.matches.length,
      matchType: verified,
    })
  }

  return nodes
}

/**
 * 智能双层匹配校验（RF-111 自 aggregateBlocksToDocs 拆出的纯函数段）。
 * 返回 'drop' 表示不满足多词组合逻辑，文档应被丢弃。
 *
 * 已知缺陷（现状钉住于 tests/global-search-aggregator.test.ts，修复需单独决策）：
 * 跨块校验用 occ.text.includes(词) 判定——occ.text 是命中的原文而非查询词本身，
 * 对正则词（如 `深\S+`）或拼音词（如 `sz` 命中"深圳"）includes 恒为 false，
 * 会导致跨块联合匹配被误杀。与 collectOccurrencesForTerms（走 regex/pinyin
 * 真实匹配）的语义不一致。
 */
function verifyCrossBlockMatch(
  matches: GlobalMatchSnippet[],
  mustInclude: string[],
  orGroups: string[][],
): 'exact-block' | 'cross-block' | 'drop' {
  const hasExactBlockMatch = matches.some((m) => m.isFullBlockMatch)

  if (hasExactBlockMatch) {
    return 'exact-block'
  }

  // 跨块联合匹配校验：收集该文档所有命中块涵盖的所有关键词
  const allDocMatchedTerms = new Set<string>()
  for (const m of matches) {
    if (m.occurrences) {
      for (const occ of m.occurrences) {
        const text = occ.text.toLowerCase()
        for (const must of mustInclude) {
          if (text.includes(must.toLowerCase())) {
            allDocMatchedTerms.add(must)
          }
        }
        for (const group of orGroups) {
          for (const word of group) {
            if (text.includes(word.toLowerCase())) {
              allDocMatchedTerms.add(word)
            }
          }
        }
      }
    }
  }

  const coversAllMust = mustInclude.every((t) => allDocMatchedTerms.has(t))
  const coversAllOr = orGroups.length === 0 || orGroups.every((g) => g.some((t) => allDocMatchedTerms.has(t)))

  return coversAllMust && coversAllOr ? 'cross-block' : 'drop'
}

/**
 * 对 Doc-First 聚合节点进行多维排序（同块完全命中优先，跨块次之）
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
        // 同块完全匹配大幅优先（+100分），跨块匹配降级排在后面
        const aBlockTypeScore = a.matchType === 'exact-block' ? 100 : 0
        const bBlockTypeScore = b.matchType === 'exact-block' ? 100 : 0

        // 标题命中加分 (+50分)
        const aTitleMatch = q && a.docTitle.toLowerCase().includes(q) ? 50 : 0
        const bTitleMatch = q && b.docTitle.toLowerCase().includes(q) ? 50 : 0

        const aScore = aBlockTypeScore + aTitleMatch + a.totalCount
        const bScore = bBlockTypeScore + bTitleMatch + b.totalCount

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
