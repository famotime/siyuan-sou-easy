import { querySql } from '../kernel'
import type { GlobalSearchFilters, ParsedGlobalQuery, RawBlockRecord } from './types'

export interface NotebookInfo {
  id: string
  name: string
  icon?: string
  closed?: boolean
}

export interface BuildGlobalSearchSqlOptions {
  limit?: number
  offset?: number
  useRegex?: boolean
  docOnly?: boolean
  parsedQuery?: ParsedGlobalQuery
}

/**
 * 转义 SQL 字符串中的单引号防注入
 */
export function escapeSqlString(str: string): string {
  return str.replace(/'/g, "''")
}

/**
 * 构建全库检索 SQL 语句
 */
export function buildGlobalSearchSql(
  keyword: string,
  filters: GlobalSearchFilters = {},
  options: BuildGlobalSearchSqlOptions = {},
): string {
  const whereClauses: string[] = []

  // 关键词过滤（当非正则时在 SQL 中使用 LIKE 初筛提升性能）
  if (!options.useRegex) {
    if (options.parsedQuery) {
      const { mustInclude = [], orGroups = [], exclude = [] } = options.parsedQuery

      // 1. 包含项初筛 (mustInclude 和 orGroups 中的任意候选词进行初筛拉取)
      const positiveTerms: string[] = [
        ...mustInclude,
        ...orGroups.flat(),
      ].filter(Boolean)

      if (positiveTerms.length > 0) {
        const orClauses = positiveTerms.map(term => {
          const escaped = escapeSqlString(term)
          return `(content LIKE '%${escaped}%' OR fcontent LIKE '%${escaped}%')`
        })
        whereClauses.push(`(${orClauses.join(' OR ')})`)
      }

      // 2. 排除词初筛 (NOT LIKE)
      if (exclude.length > 0) {
        for (const neg of exclude) {
          const escaped = escapeSqlString(neg)
          whereClauses.push(`(content NOT LIKE '%${escaped}%' AND fcontent NOT LIKE '%${escaped}%')`)
        }
      }
    } else if (keyword) {
      const escaped = escapeSqlString(keyword)
      whereClauses.push(`(content LIKE '%${escaped}%' OR fcontent LIKE '%${escaped}%')`)
    }
  }

  // 笔记本过滤
  if (filters.notebookId) {
    whereClauses.push(`box = '${escapeSqlString(filters.notebookId)}'`)
  }

  // 路径前缀过滤
  if (filters.pathPrefix) {
    const escapedPath = escapeSqlString(filters.pathPrefix)
    whereClauses.push(`hpath LIKE '%${escapedPath}%'`)
  }

  // 标签过滤
  if (filters.tags && filters.tags.length > 0) {
    const tagConditions = filters.tags.map(t => `tag LIKE '%#${escapeSqlString(t)}%' OR tag LIKE '%${escapeSqlString(t)}%'`)
    whereClauses.push(`(${tagConditions.join(' OR ')})`)
  }

  // 块类型过滤（当启用仅搜索文档时，限制仅搜索文档根块 type = 'd'）
  if (options.docOnly) {
    whereClauses.push(`type = 'd'`)
  } else if (filters.types && filters.types.length > 0) {
    const typesStr = filters.types.map(t => `'${escapeSqlString(t)}'`).join(',')
    whereClauses.push(`type IN (${typesStr})`)
  }

  // 时间范围过滤
  if (filters.dateRange?.start) {
    const cleanStart = filters.dateRange.start.replace(/[-:\s]/g, '')
    whereClauses.push(`updated >= '${escapeSqlString(cleanStart)}'`)
  }
  if (filters.dateRange?.end) {
    const cleanEnd = filters.dateRange.end.replace(/[-:\s]/g, '')
    whereClauses.push(`updated <= '${escapeSqlString(cleanEnd)}'`)
  }

  const wherePart = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''
  const limitPart = `LIMIT ${options.limit || 300}`
  const offsetPart = options.offset ? `OFFSET ${options.offset}` : ''

  return `SELECT id, parent_id, root_id, box, path, hpath, content, fcontent, markdown, type, subtype, sort, created, updated FROM blocks ${wherePart} ORDER BY updated DESC ${limitPart} ${offsetPart}`.trim()
}

/**
 * 执行底层 SQL 全库检索
 */
export async function executeGlobalBlockQuery(
  keyword: string,
  filters: GlobalSearchFilters = {},
  options: BuildGlobalSearchSqlOptions = {},
): Promise<RawBlockRecord[]> {
  const sql = buildGlobalSearchSql(keyword, filters, options)
  try {
    const records = await querySql(sql)
    return (records || []) as RawBlockRecord[]
  } catch (error) {
    console.error('executeGlobalBlockQuery failed:', error)
    return []
  }
}

/**
 * 获取知识库所有笔记本
 */
export async function fetchNotebooks(): Promise<NotebookInfo[]> {
  try {
    const records = await querySql('SELECT DISTINCT box, hpath FROM blocks LIMIT 500')
    const notebookMap = new Map<string, NotebookInfo>()
    for (const r of (records || [])) {
      if (r.box && !notebookMap.has(r.box)) {
        notebookMap.set(r.box, {
          id: r.box,
          name: r.box,
        })
      }
    }
    return Array.from(notebookMap.values())
  } catch {
    return []
  }
}
