/**
 * 拼音匹配核心引擎
 * 基于 pinyin-match (MIT License) 算法原理重构与扩展
 */
import { PINYIN_DICT } from './dict'

const uv = ['ju', 'jun', 'jue', 'juan', 'qu', 'qun', 'que', 'xuan', 'xu', 'xue', 'yu', 'yuan', 'yue', 'yun', 'nve', 'lve']
const vList = ['lv', 'lve', 'nv', 'nve']
const accentVList = ['lü', 'lüe', 'nü', 'nüe']

function replaceUv(str: string): string {
  if (str.includes('u')) return str.replace(/u/g, 'v')
  return str.replace(/v/g, 'u')
}

// 缓存与词典映射
const allPinyin: string[] = []
let charPinyinMap: Record<string, string> = {}
const keyStorage: Record<string, string[][]> = {}

function initDict(dict: Record<string, string>) {
  const handledDict: Record<string, string> = {}
  for (const key of Object.keys(dict)) {
    handledDict[key] = dict[key]
    allPinyin.push(key)
    if (uv.includes(key)) {
      const replacedKey = replaceUv(key)
      handledDict[replacedKey] = dict[key]
      allPinyin.push(replacedKey)
    }
    if (vList.includes(key)) {
      const replacedKey = key.replace('v', 'ü')
      handledDict[replacedKey] = dict[key]
      allPinyin.push(replacedKey)
    }
  }

  charPinyinMap = {}
  for (const py in handledDict) {
    const chars = handledDict[py]
    for (let j = 0; j < chars.length; j++) {
      const ch = chars[j]
      if (!charPinyinMap[ch]) {
        charPinyinMap[ch] = py
      } else {
        charPinyinMap[ch] = `${charPinyinMap[ch]} ${py}`
      }
    }
  }
}

// 初始化字典
initDict(PINYIN_DICT)

function getPinyin(cn: string): string[] {
  const result: string[] = []
  for (let i = 0; i < cn.length; i++) {
    const ch = cn.charAt(i)
    result.push(charPinyinMap[ch] || ch)
  }
  return result
}

function getAllSolutions(
  start: number,
  s: string,
  result: (string | string[])[],
  solutions: string[],
  possible: boolean[],
) {
  const len = s.length
  if (start === len) {
    solutions.push(result.join(' '))
    return
  }
  for (let i = start; i < len; i++) {
    const piece = s.substring(start, i + 1)
    let match = false
    // 最后一个音特殊处理，不需要全部打完整
    if (allPinyin.some(item => item.startsWith(piece)) && !s[i + 1] && possible[i + 1]) {
      if (piece.length === 1) {
        result.push(piece)
      } else {
        const matching: string[] = []
        for (const item of allPinyin) {
          if (item.startsWith(piece)) {
            matching.push(item)
          }
        }
        result.push(matching)
      }
      match = true
    } else {
      if (allPinyin.includes(piece) && possible[i + 1]) {
        result.push(piece)
        match = true
      }
    }
    if (match) {
      const beforeChange = solutions.length
      getAllSolutions(i + 1, s, result, solutions, possible)
      if (solutions.length === beforeChange) {
        possible[i + 1] = false
      }
      result.pop()
    }
  }
}

function wordBreak(s: string): string[] {
  const result: (string | string[])[] = []
  const solutions: string[] = []
  const possible: boolean[] = Array.from({ length: s.length + 1 }, () => true)
  getAllSolutions(0, s, result, solutions, possible)
  return solutions
}

function getFullKey(key: string): string[][] {
  const result: string[][] = []
  const solutions = wordBreak(key)
  for (const sol of solutions) {
    const item = sol.split(' ')
    const last = item.length - 1
    if (item[last].includes(',')) {
      const keys = item[last].split(',')
      for (const k of keys) {
        const copy = [...item]
        copy[last] = k
        result.push(copy)
      }
    } else {
      result.push(item)
    }
  }
  if (result.length === 0 || result[0].length !== key.length) {
    result.push(key.split(''))
  }
  keyStorage[key] = result
  return result
}

function point2point(test: string, key: string, last: boolean, extend: boolean): boolean {
  if (!test) return false
  const a = test.split(' ')
  if (extend) {
    const len = a.length
    for (let i = 0; i < len; i++) {
      if (a[i].length > 0) {
        a.push(a[i].charAt(0))
      }
    }
  }
  if (!last) {
    return a.includes(key)
  }
  return a.some(item => item.startsWith(key))
}

function normalizeKey(keys: string): string {
  let normalized = keys.replace(/\s+/g, '').toLowerCase()
  if (accentVList.some(v => normalized.includes(v))) {
    normalized = normalized.replace(/ü/g, 'v')
  }
  return normalized.normalize('NFD').replace(/[\u0300-\u036F]/g, '')
}

function getIndex(py: string[], fullString: string[][], keys: string): [number, number] | false {
  for (let p = 0; p < py.length; p++) {
    for (let k = 0; k < fullString.length; k++) {
      const key = fullString[k]
      const keyLength = key.length
      const extend = keyLength === keys.length
      let isMatch = true
      let i = 0
      let preSpaceNum = 0
      let spaceNum = 0
      if (keyLength <= py.length) {
        for (; i < key.length; i++) {
          if (i === 0 && py[p + i + preSpaceNum] === ' ') {
            preSpaceNum += 1
            i -= 1
          } else {
            if (py[p + i + spaceNum] === ' ') {
              spaceNum += 1
              i -= 1
            } else {
              const last = Boolean(!py[p + i + 1] || !key[i + 1])
              if (!point2point(py[p + i + spaceNum], key[i], last, extend)) {
                isMatch = false
                break
              }
            }
          }
        }
        if (isMatch) {
          return [p + preSpaceNum, spaceNum + p + i - 1]
        }
      }
    }
  }
  return false
}

/**
 * 匹配拼音或文本
 * 返回匹配的闭区间 [start, end] 或者 false
 */
export function matchPinyinRange(input: string, rawKeys: string): [number, number] | false {
  if (!input || !rawKeys) return false
  const normInput = input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036F]/g, '')
  const keys = normalizeKey(rawKeys)
  if (!keys) return false

  const indexOf = normInput.indexOf(keys)
  if (indexOf !== -1) {
    return [indexOf, indexOf + keys.length - 1]
  }

  // 原文匹配 (带空格)
  const noPyIndex = getIndex(normInput.split(''), [keys.split('')], keys)
  if (noPyIndex) return noPyIndex

  // 拼音匹配
  const py = getPinyin(normInput)
  const fullString = keyStorage[keys] || getFullKey(keys)
  return getIndex(py, fullString, keys)
}

/**
 * 查找文本中全部匹配的闭区间列表
 */
export function matchAllPinyinRanges(input: string, rawKeys: string): Array<[number, number]> {
  if (!input || !rawKeys) return []
  const results: Array<[number, number]> = []
  let offset = 0

  while (offset < input.length) {
    const sub = input.slice(offset)
    const matched = matchPinyinRange(sub, rawKeys)
    if (!matched) break

    const [subStart, subEnd] = matched
    const start = offset + subStart
    const end = offset + subEnd
    results.push([start, end])

    // 向后推移步长，至少向前进 1
    offset = offset + Math.max(subStart + 1, subEnd + 1)
  }

  return results
}

/**
 * 获取汉字字符对应的拼音首字母
 */
export function getCharPinyinInitial(ch: string): string {
  if (!ch) return ''
  if (/[a-zA-Z0-9]/.test(ch)) {
    return ch.toLowerCase()
  }
  const pinyins = charPinyinMap[ch]
  if (pinyins) {
    const firstPinyin = pinyins.split(' ')[0]
    return firstPinyin.charAt(0).toLowerCase()
  }
  return ch.toLowerCase()
}
