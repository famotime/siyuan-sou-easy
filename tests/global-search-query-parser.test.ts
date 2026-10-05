import { describe, expect, it } from 'vitest'
import { parseGlobalQuery } from '@/features/search-replace/global/query-parser'

describe('parseGlobalQuery', () => {
  it('parses empty query', () => {
    const res = parseGlobalQuery('')
    expect(res.rawQuery).toBe('')
    expect(res.textQuery).toBe('')
    expect(res.tags).toEqual([])
    expect(res.types).toEqual([])
  })

  it('parses plain text query without filters', () => {
    const res = parseGlobalQuery('hello world')
    expect(res.rawQuery).toBe('hello world')
    expect(res.textQuery).toBe('hello world')
    expect(res.notebook).toBeUndefined()
    expect(res.path).toBeUndefined()
    expect(res.tags).toEqual([])
  })

  it('parses inline filters for path, tag, and type', () => {
    const res = parseGlobalQuery('path:日记 tag:工作 type:h 需求评审')
    expect(res.textQuery).toBe('需求评审')
    expect(res.path).toBe('日记')
    expect(res.tags).toEqual(['工作'])
    expect(res.types).toEqual(['h'])
  })

  it('handles #tag syntax and type aliases', () => {
    const res = parseGlobalQuery('notebook:工作空间 #重要 type:code 数据库连接')
    expect(res.textQuery).toBe('数据库连接')
    expect(res.notebook).toBe('工作空间')
    expect(res.tags).toEqual(['重要'])
    expect(res.types).toEqual(['c'])
  })

  it('handles multiple tags and dateFilter', () => {
    const res = parseGlobalQuery('tag:前端 tag:Vue updated:7d 响应式原理')
    expect(res.textQuery).toBe('响应式原理')
    expect(res.tags).toEqual(['前端', 'Vue'])
    expect(res.dateFilter).toBe('7d')
  })
})
