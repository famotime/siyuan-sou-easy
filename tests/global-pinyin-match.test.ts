import { describe, expect, it } from 'vitest'
import {
  getCharFirstLetter,
  getPinyinInitials,
  matchFullPinyin,
  matchPinyinInitials,
} from '@/features/search-replace/global/pinyin-match'

describe('pinyin-match', () => {
  it('gets first letter of characters correctly', () => {
    expect(getCharFirstLetter('产')).toBe('c')
    expect(getCharFirstLetter('品')).toBe('p')
    expect(getCharFirstLetter('A')).toBe('a')
    expect(getCharFirstLetter('1')).toBe('1')
  })

  it('gets initials string of phrase', () => {
    expect(getPinyinInitials('产品经理')).toBe('cpjl')
    expect(getPinyinInitials('文档修改')).toBe('wdxg')
  })

  it('matches pinyin initials in full text', () => {
    const text = '这是我们最新的产品经理招聘要求。'
    const res = matchPinyinInitials(text, 'cpjl')
    expect(res).not.toBeNull()
    expect(res?.matchedText).toBe('产品经理')
    expect(res?.start).toBe(7)
    expect(res?.end).toBe(11)
  })

  it('matches full pinyin in full text', () => {
    const text = '关于思源笔记的全面重构计划'
    const res = matchFullPinyin(text, 'siyuan')
    expect(res).not.toBeNull()
    expect(res?.matchedText).toBe('思源')
  })
})
