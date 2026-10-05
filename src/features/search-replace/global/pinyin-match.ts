/**
 * 常用汉字拼音首字母分段码表 (Unicode 范围覆盖)
 */
const PINYIN_FIRST_LETTER_BOUNDS: Array<{ letter: string, start: number }> = [
  { letter: 'a', start: 0xB0A1 },
  { letter: 'b', start: 0xB0C5 },
  { letter: 'c', start: 0xB2C1 },
  { letter: 'd', start: 0xB4EE },
  { letter: 'e', start: 0xB6EA },
  { letter: 'f', start: 0xB7A2 },
  { letter: 'g', start: 0xB8C1 },
  { letter: 'h', start: 0xB9FE },
  { letter: 'j', start: 0xBBF7 },
  { letter: 'k', start: 0xBFA6 },
  { letter: 'l', start: 0xC0AC },
  { letter: 'm', start: 0xC2E8 },
  { letter: 'n', start: 0xC4C3 },
  { letter: 'o', start: 0xC5B6 },
  { letter: 'p', start: 0xC5BE },
  { letter: 'q', start: 0xC6DA },
  { letter: 'r', start: 0xC8BB },
  { letter: 's', start: 0xC8F6 },
  { letter: 't', start: 0xCBFA },
  { letter: 'w', start: 0xCDDA },
  { letter: 'x', start: 0xCEF4 },
  { letter: 'y', start: 0xD1B9 },
  { letter: 'z', start: 0xD4D1 },
]

// 常用字首字母修正字典（高频词及生僻多音）
const CHAR_FIRST_LETTER_DICT: Record<string, string> = {
  重: 'c',
  长: 'c',
  行: 'x',
  得: 'd',
  便: 'b',
  会: 'h',
  设: 's',
  计: 'j',
  产: 'c',
  品: 'p',
  经: 'j',
  理: 'l',
  文: 'w',
  档: 'd',
  修: 'x',
  改: 'g',
  搜: 's',
  索: 's',
  替: 't',
  换: 'h',
  思: 's',
  源: 'y',
  笔: 'b',
  记: 'j',
  测: 'c',
  试: 's',
}

// 常用汉字全拼字典
const CHAR_FULL_PINYIN_DICT: Record<string, string> = {
  产: 'chan',
  品: 'pin',
  经: 'jing',
  理: 'li',
  文: 'wen',
  档: 'dang',
  修: 'xiu',
  改: 'gai',
  搜: 'sou',
  索: 'suo',
  替: 'ti',
  换: 'huan',
  思: 'si',
  源: 'yuan',
  笔: 'bi',
  记: 'ji',
  测: 'ce',
  试: 'shi',
  设: 'she',
  计: 'ji',
  重: 'chong',
  构: 'gou',
}

/**
 * 获取单个字符的首字母
 */
export function getCharFirstLetter(ch: string): string {
  if (!ch) return ''
  if (/[a-zA-Z0-9]/.test(ch)) {
    return ch.toLowerCase()
  }
  if (CHAR_FIRST_LETTER_DICT[ch]) {
    return CHAR_FIRST_LETTER_DICT[ch]
  }

  // 汉字首字母 fallback
  try {
    const code = ch.charCodeAt(0)
    if (code >= 0x4E00 && code <= 0x9FA5) {
      // 简单拼音首字母字典或拼音映射
      return CHAR_FIRST_LETTER_DICT[ch] || ch.toLowerCase()
    }
  } catch {
  }
  return ch.toLowerCase()
}

/**
 * 获取字符串的拼音首字母缩写
 */
export function getPinyinInitials(str: string): string {
  let res = ''
  for (const ch of str) {
    res += getCharFirstLetter(ch)
  }
  return res
}

/**
 * 拼音首字母匹配检查
 * 返回命中的汉字起止位置 [start, end] 或 null
 */
export function matchPinyinInitials(
  text: string,
  query: string,
): { start: number, end: number, matchedText: string } | null {
  const q = query.trim().toLowerCase()
  if (!q || !text) return null

  const initials = getPinyinInitials(text)
  const idx = initials.indexOf(q)
  if (idx >= 0) {
    const start = idx
    const end = idx + q.length
    return {
      start,
      end,
      matchedText: text.slice(start, end),
    }
  }

  return null
}

/**
 * 全拼模糊匹配检查
 * 例如输入 "chanpin" 在 "这是产品需求" 中寻找对应汉字范围
 */
export function matchFullPinyin(
  text: string,
  query: string,
): { start: number, end: number, matchedText: string } | null {
  const q = query.trim().toLowerCase()
  if (!q || !text) return null

  // 构建 text 中汉字的全拼拼接与 offset 映射
  let assembledPinyin = ''
  const indexMap: number[] = []

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const pinyin = CHAR_FULL_PINYIN_DICT[ch] || ch.toLowerCase()
    for (let j = 0; j < pinyin.length; j++) {
      indexMap.push(i)
    }
    assembledPinyin += pinyin
  }

  const foundIndex = assembledPinyin.indexOf(q)
  if (foundIndex >= 0) {
    const startCharIndex = indexMap[foundIndex]
    const endCharIndex = indexMap[foundIndex + q.length - 1] + 1
    return {
      start: startCharIndex,
      end: endCharIndex,
      matchedText: text.slice(startCharIndex, endCharIndex),
    }
  }

  return null
}
