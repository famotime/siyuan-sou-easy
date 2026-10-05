import { describe, expect, it } from 'vitest'
import {
  findAllPinyinMatches,
  getCharFirstLetter,
  getPinyinInitials,
  matchFullPinyin,
  matchPinyin,
  matchPinyinInitials,
} from '@/features/search-replace/global/pinyin-match'

describe('pinyin-match', () => {
  it('gets first letter of characters correctly', () => {
    expect(getCharFirstLetter('产')).toBe('c')
    expect(getCharFirstLetter('品')).toBe('p')
    expect(getCharFirstLetter('A')).toBe('a')
    expect(getCharFirstLetter('1')).toBe('1')
    expect(getCharFirstLetter('深')).toBe('s')
    expect(getCharFirstLetter('圳')).toBe('z')
  })

  it('gets initials string of phrase', () => {
    expect(getPinyinInitials('产品经理')).toBe('cpjl')
    expect(getPinyinInitials('文档修改')).toBe('wdxg')
    expect(getPinyinInitials('深圳')).toBe('sz')
    expect(getPinyinInitials('北京天安门')).toBe('bjtam')
  })

  it('matches pinyin initials in full text', () => {
    const text = '这是我们最新的产品经理招聘要求。'
    const res = matchPinyinInitials(text, 'cpjl')
    expect(res).not.toBeNull()
    expect(res?.matchedText).toBe('产品经理')
    expect(res?.start).toBe(7)
    expect(res?.end).toBe(11)
  })

  it('matches sz to 深圳 correctly', () => {
    const text = '今日来到深圳出差。'
    const res = matchPinyinInitials(text, 'sz')
    expect(res).not.toBeNull()
    expect(res?.matchedText).toBe('深圳')
    expect(res?.start).toBe(4)
    expect(res?.end).toBe(6)
  })

  it('matches full pinyin in full text', () => {
    const text = '关于思源笔记的全面重构计划'
    const res = matchFullPinyin(text, 'siyuan')
    expect(res).not.toBeNull()
    expect(res?.matchedText).toBe('思源')

    const res2 = matchFullPinyin('欢迎来到深圳', 'shenzhen')
    expect(res2).not.toBeNull()
    expect(res2?.matchedText).toBe('深圳')
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
    const resUpper = matchPinyin(text, 'SZ')
    expect(resUpper).not.toBeNull()
    expect(resUpper?.matchedText).toBe('深圳')
  })
})
