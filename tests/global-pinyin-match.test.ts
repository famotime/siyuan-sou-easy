import { describe, expect, it } from 'vitest'
import {
  findAllPinyinMatches,
} from '@/features/search-replace/global/pinyin-match'

describe('pinyin-match', () => {
  it('matches sz to 深圳 correctly', () => {
    const text = '今日来到深圳出差。'
    const results = findAllPinyinMatches(text, 'sz')
    expect(results).toHaveLength(1)
    expect(results[0].matchedText).toBe('深圳')
    expect(results[0].start).toBe(4)
    expect(results[0].end).toBe(6)
  })

  it('matches cpjl to 产品经理 correctly', () => {
    const text = '这是我们最新的产品经理招聘要求。'
    const results = findAllPinyinMatches(text, 'cpjl')
    expect(results).toHaveLength(1)
    expect(results[0].matchedText).toBe('产品经理')
    expect(results[0].start).toBe(7)
    expect(results[0].end).toBe(11)
  })

  it('matches full pinyin in full text', () => {
    const text = '关于思源笔记的全面重构计划'
    const results = findAllPinyinMatches(text, 'siyuan')
    expect(results).toHaveLength(1)
    expect(results[0].matchedText).toBe('思源')

    const results2 = findAllPinyinMatches('欢迎来到深圳', 'shenzhen')
    expect(results2).toHaveLength(1)
    expect(results2[0].matchedText).toBe('深圳')
  })

  it('matches multiple occurrences with findAllPinyinMatches', () => {
    const text = '深圳很美，我爱深圳。'
    const results = findAllPinyinMatches(text, 'sz')
    expect(results).toHaveLength(2)
    expect(results[0].matchedText).toBe('深圳')
    expect(results[0].start).toBe(0)
    expect(results[0].end).toBe(2)
    expect(results[1].matchedText).toBe('深圳')
    expect(results[1].start).toBe(7)
    expect(results[1].end).toBe(9)
  })

  it('supports case-insensitive matching', () => {
    const text = '来到深圳'
    const results = findAllPinyinMatches(text, 'SZ')
    expect(results).toHaveLength(1)
    expect(results[0].matchedText).toBe('深圳')
  })
})
