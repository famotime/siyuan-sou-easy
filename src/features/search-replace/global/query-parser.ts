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
 * 解析用户输入的搜索语句，抽取出行内过滤语法
 * 例如: path:读书笔记 tag:哲学 type:h 存在主义
 */
export function parseGlobalQuery(raw: string): ParsedGlobalQuery {
  const trimmed = raw.trim()
  if (!trimmed) {
    return {
      rawQuery: '',
      textQuery: '',
      tags: [],
      types: [],
    }
  }

  const parts = trimmed.split(/\s+/)
  const textParts: string[] = []
  const tags: string[] = []
  const types: string[] = []
  let notebook: string | undefined
  let path: string | undefined
  let dateFilter: string | undefined

  for (const part of parts) {
    const colonIndex = part.indexOf(':')
    if (colonIndex > 0 && colonIndex < part.length - 1) {
      const key = part.slice(0, colonIndex).toLowerCase()
      const val = part.slice(colonIndex + 1).trim()

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

    // 处理独立的 #标签 简写
    if (part.startsWith('#') && part.length > 1 && !part.includes(':')) {
      tags.push(part.slice(1))
      continue
    }

    textParts.push(part)
  }

  return {
    rawQuery: trimmed,
    textQuery: textParts.join(' '),
    notebook,
    path,
    tags,
    types,
    dateFilter,
  }
}
