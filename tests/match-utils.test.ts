import { describe, expect, it } from 'vitest'
import { parsePreviewSegments } from '../src/features/search-replace/match-utils'

describe('parsePreviewSegments', () => {
  it('parses bracketed preview text into segments without brackets', () => {
    const segments = parsePreviewSegments('《隋[书]·经籍志》 载有 《春秋左氏解谊》 三十一...', '书')
    expect(segments).toEqual([
      { text: '《隋', isMatch: false },
      { text: '书', isMatch: true },
      { text: '·经籍志》 载有 《春秋左氏解谊》 三十一...', isMatch: false },
    ])
  })

  it('handles attribute view candidate preview text', () => {
    const segments = parsePreviewSegments('固定列: [传感器]-fixed', '传感器')
    expect(segments).toEqual([
      { text: '固定列: ', isMatch: false },
      { text: '传感器', isMatch: true },
      { text: '-fixed', isMatch: false },
    ])
  })

  it('falls back to bracket regex if matchedText is not provided', () => {
    const segments = parsePreviewSegments('前文 [关键词] 后文')
    expect(segments).toEqual([
      { text: '前文 ', isMatch: false },
      { text: '关键词', isMatch: true },
      { text: ' 后文', isMatch: false },
    ])
  })

  it('returns single unformatted segment if no match brackets are present', () => {
    const segments = parsePreviewSegments('无匹配项的简单说明文本')
    expect(segments).toEqual([
      { text: '无匹配项的简单说明文本', isMatch: false },
    ])
  })
})
