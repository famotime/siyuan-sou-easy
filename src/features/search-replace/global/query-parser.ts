import type { ParsedGlobalQuery } from './types'

const TYPE_ALIAS_MAP: Record<string, string> = {
  h: 'h',
  heading: 'h',
  title: 'h',
  header: 'h',
  p: 'p',
  paragraph: 'p',
  text: 'p',
  c: 'c',
  code: 'c',
  codeblock: 'c',
  t: 't',
  table: 't',
  l: 'l',
  list: 'l',
  i: 'i',
  item: 'i',
  b: 'b',
  quote: 'b',
  m: 'm',
  math: 'm',
  s: 's',
  super: 's',
  av: 'av',
  database: 'av',
  doc: 'd',
  d: 'd',
}

/**
 * 清除首尾配对的引号（支持英文双引号 "" 以及中文双引号 “”）
 */
export function stripQuotes(str: string): string {
  const trimmed = str.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith('“') && trimmed.endsWith('”') && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

/**
 * 分词工具：将 raw 字符串切分为 Tokens，保留双引号内的空格并支持各类修饰符
 */
export function tokenizeGlobalQuery(raw: string): string[] {
  const tokens: string[] = []
  // 1: 冒号带引号的属性过滤: [a-zA-Z]+:(".*?"|“.*?”)
  // 2: 减号带引号短语: -(".*?"|“.*?”)
  // 3: 独立引号短语: (".*?"|“.*?”)
  // 4: 非空白连续字符: \S+
  const regex = /([a-zA-Z]+:(?:"[^"]*"|“[^”]*”))|(-(?:"[^"]*"|“[^”]*”))|("[^"]*"|“[^”]*”)|(\S+)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(raw)) !== null) {
    const token = match[0].trim()
    if (token) {
      tokens.push(token)
    }
  }
  return tokens
}

/**
 * 解析用户输入的搜索语句，抽取出行内过滤语法并支持 Google 搜索引擎语法
 * 规则支持：
 * 1. 空格分隔：默认 AND 逻辑
 * 2. "精确短语"：内部空格不切分
 * 3. -排除词 或 -"排除短语"：NOT 逻辑
 * 4. 大写 OR 或 |：逻辑或
 * 5. 行内过滤：tag:, #, type:, notebook:, path:, updated: 等
 */
export function parseGlobalQuery(raw: string): ParsedGlobalQuery {
  const trimmed = raw.trim()
  if (!trimmed) {
    return {
      rawQuery: '',
      textQuery: '',
      mustInclude: [],
      orGroups: [],
      exclude: [],
      isMultiTermQuery: false,
      tags: [],
      types: [],
    }
  }

  const tokens = tokenizeGlobalQuery(trimmed)
  const tags: string[] = []
  const types: string[] = []
  const exclude: string[] = []
  let notebook: string | undefined
  let path: string | undefined
  let dateFilter: string | undefined

  // 待处理的纯文本关键词与运算符列表
  const rawTextTokens: string[] = []

  for (const token of tokens) {
    // 1. 处理属性过滤 key:val
    const colonIndex = token.indexOf(':')
    if (colonIndex > 0 && colonIndex < token.length - 1) {
      const key = token.slice(0, colonIndex).toLowerCase()
      const rawVal = token.slice(colonIndex + 1).trim()
      const val = stripQuotes(rawVal)

      if (key === 'notebook' || key === 'box') {
        notebook = val
        continue
      }
      if (key === 'path') {
        path = val
        continue
      }
      if (key === 'tag') {
        const cleanedTag = val.replace(/^#/, '')
        if (cleanedTag) {
          tags.push(cleanedTag)
        }
        continue
      }
      if (key === 'type') {
        const canonical = TYPE_ALIAS_MAP[val.toLowerCase()] || val.toLowerCase()
        types.push(canonical)
        continue
      }
      if (key === 'updated' || key === 'date' || key === 'time') {
        dateFilter = val.toLowerCase()
        continue
      }
    }

    // 2. 处理独立的 #标签 简写
    if (token.startsWith('#') && token.length > 1 && !token.includes(':')) {
      const tagVal = stripQuotes(token.slice(1))
      if (tagVal) {
        tags.push(tagVal)
      }
      continue
    }

    // 3. 处理减号 - 排除词 (要求以 - 开头且长度大于 1)
    if (token.startsWith('-') && token.length > 1) {
      const negativeContent = stripQuotes(token.slice(1))
      if (negativeContent) {
        exclude.push(negativeContent)
      }
      continue
    }

    // 4. 其余作为文本检索词或 OR 运算符
    rawTextTokens.push(token)
  }

  // 处理 OR 操作符与常规必须词
  // 规则：遇到大写 'OR' 或 '|' 时，将前一个词与后一个词合并为一组
  const orGroups: string[][] = []
  const mustInclude: string[] = []

  let i = 0
  while (i < rawTextTokens.length) {
    const cur = rawTextTokens[i]

    if (cur === 'OR' || cur === '|') {
      // 孤立的 OR 忽略
      i++
      continue
    }

    // 检查后面是否紧跟着 OR / |
    if (i + 1 < rawTextTokens.length && (rawTextTokens[i + 1] === 'OR' || rawTextTokens[i + 1] === '|')) {
      const currentOrGroup: string[] = [stripQuotes(cur)]
      let nextIdx = i + 1

      while (nextIdx < rawTextTokens.length && (rawTextTokens[nextIdx] === 'OR' || rawTextTokens[nextIdx] === '|')) {
        const targetWordIdx = nextIdx + 1
        if (targetWordIdx < rawTextTokens.length && rawTextTokens[targetWordIdx] !== 'OR' && rawTextTokens[targetWordIdx] !== '|') {
          currentOrGroup.push(stripQuotes(rawTextTokens[targetWordIdx]))
          nextIdx += 2
        } else {
          // OR 后面没有词了
          nextIdx += 1
          break
        }
      }

      if (currentOrGroup.length > 1) {
        orGroups.push(currentOrGroup)
      } else {
        mustInclude.push(currentOrGroup[0])
      }
      i = nextIdx
    } else {
      mustInclude.push(stripQuotes(cur))
      i++
    }
  }

  // 拼接规范的 textQuery（用于概览和回显）
  const allTermsForDisplay = [
    ...mustInclude,
    ...orGroups.map(g => g.join(' OR ')),
  ]
  const textQuery = allTermsForDisplay.join(' ')

  // 判定是否为多关键词组合搜索
  // 规则：只要有排除词、OR分组、或有 2 个及以上的普通词，就视为组合搜索
  const isMultiTermQuery =
    exclude.length > 0 ||
    orGroups.length > 0 ||
    mustInclude.length > 1 ||
    (mustInclude.length > 0 && orGroups.length > 0)

  // 提取单一关键词（仅当只有 1 个 mustInclude 且无任何其他修饰符时生效）
  const singleKeyword =
    !isMultiTermQuery && mustInclude.length === 1 ? mustInclude[0] : undefined

  return {
    rawQuery: trimmed,
    textQuery,
    mustInclude,
    orGroups,
    exclude,
    isMultiTermQuery,
    singleKeyword,
    notebook,
    path,
    tags,
    types,
    dateFilter,
  }
}
