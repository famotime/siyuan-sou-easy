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
    expect(res.isMultiTermQuery).toBe(false)
    expect(res.singleKeyword).toBe('响应式原理')
  })

  it('supports multiple keywords with space (AND logic)', () => {
    const res = parseGlobalQuery('思源 插件 开发')
    expect(res.mustInclude).toEqual(['思源', '插件', '开发'])
    expect(res.isMultiTermQuery).toBe(true)
    expect(res.singleKeyword).toBeUndefined()
  })

  it('supports exact phrase with quotes', () => {
    const res = parseGlobalQuery('"siyuan note" 插件')
    expect(res.mustInclude).toEqual(['siyuan note', '插件'])
    expect(res.isMultiTermQuery).toBe(true)

    // 单个双引号短语应允许作为单个关键词用于替换
    const singleRes = parseGlobalQuery('"siyuan note"')
    expect(singleRes.mustInclude).toEqual(['siyuan note'])
    expect(singleRes.isMultiTermQuery).toBe(false)
    expect(singleRes.singleKeyword).toBe('siyuan note')
  })

  it('supports exclude keywords with minus sign (NOT logic)', () => {
    const res = parseGlobalQuery('读书笔记 -草稿 -"临时 文档"')
    expect(res.mustInclude).toEqual(['读书笔记'])
    expect(res.exclude).toEqual(['草稿', '临时 文档'])
    expect(res.isMultiTermQuery).toBe(true)
  })

  it('supports OR logic operator with uppercase OR or pipe |', () => {
    const res1 = parseGlobalQuery('方案A OR 方案B')
    expect(res1.orGroups).toEqual([['方案A', '方案B']])
    expect(res1.isMultiTermQuery).toBe(true)

    const res2 = parseGlobalQuery('苹果 | 香蕉 | 橙子 水果')
    expect(res2.orGroups).toEqual([['苹果', '香蕉', '橙子']])
    expect(res2.mustInclude).toEqual(['水果'])
    expect(res2.isMultiTermQuery).toBe(true)
  })
})
