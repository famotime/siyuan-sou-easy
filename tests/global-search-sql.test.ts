import { describe, expect, it } from 'vitest'
import {
  buildGlobalSearchSql,
  escapeSqlString,
} from '@/features/search-replace/global/kernel-query'

describe('kernel-query SQL builder', () => {
  it('escapes single quotes correctly', () => {
    expect(escapeSqlString("user's test")).toBe("user''s test")
  })

  it('builds basic search SQL with like clause and limit', () => {
    const sql = buildGlobalSearchSql('关键词')
    expect(sql).toContain("content LIKE '%关键词%'")
    expect(sql).toContain('LIMIT 300')
    expect(sql).toContain('ORDER BY updated DESC')
  })

  it('builds SQL with notebook and path filters', () => {
    const sql = buildGlobalSearchSql('test', {
      notebookId: 'box-123',
      pathPrefix: '/开发/前端',
    })
    expect(sql).toContain("box = 'box-123'")
    expect(sql).toContain("hpath LIKE '%/开发/前端%'")
  })

  it('builds SQL with tag, type, and date filters', () => {
    const sql = buildGlobalSearchSql('test', {
      tags: ['Todo', '工作'],
      types: ['p', 'h'],
      dateRange: {
        start: '2026-10-01',
      },
    })
    expect(sql).toContain("tag LIKE '%#Todo%'")
    expect(sql).toContain("type IN ('p','h')")
    expect(sql).toContain("updated >= '20261001'")
  })

  it('omits LIKE clause when using regex mode', () => {
    const sql = buildGlobalSearchSql('\\d+', {}, { useRegex: true })
    expect(sql).not.toContain('LIKE')
  })
})
