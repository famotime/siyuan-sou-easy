import {
  buildPreview,
  isRangeReplaceable,
} from './editor'
import type {
  SearchMatch,
  SearchOptions,
  SearchableBlock,
} from './types'

const ASCII_WORD_CHAR = /[A-Za-z0-9_]/

export function findMatches(
  blocks: SearchableBlock[],
  query: string,
  options: SearchOptions,
): { error: string, matches: SearchMatch[] } {
  const keyword = query.trim()
  if (!keyword) {
    return {
      error: '',
      matches: [],
    }
  }

  let pattern: RegExp
  try {
    pattern = createPattern(keyword, options)
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : '正则表达式无效',
      matches: [],
    }
  }

  const matches: SearchMatch[] = []
  blocks.forEach((block) => {
    pattern.lastIndex = 0
    let match = pattern.exec(block.text)
    while (match) {
      const matchedText = match[0]
      if (!matchedText.length) {
        pattern.lastIndex += 1
        match = pattern.exec(block.text)
        continue
      }

      const start = match.index
      const end = start + matchedText.length
      if (!isWholeWordMatch(block.text, start, end, options.wholeWord)) {
        match = pattern.exec(block.text)
        continue
      }

      matches.push({
        id: `${block.blockId}:${start}:${end}`,
        blockId: block.blockId,
        rootId: block.rootId,
        blockType: block.blockType,
        blockIndex: block.blockIndex,
        start,
        end,
        matchedText,
        previewText: buildPreview(block.text, start, end),
        replaceable: isRangeReplaceable(block.element, start, end),
      })

      match = pattern.exec(block.text)
    }
  })

  return {
    error: '',
    matches,
  }
}

function createPattern(query: string, options: SearchOptions) {
  const source = options.useRegex ? query : escapeForRegex(query)
  const flags = options.matchCase ? 'g' : 'gi'
  return new RegExp(source, flags)
}

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isWholeWordMatch(text: string, start: number, end: number, enabled: boolean) {
  if (!enabled) {
    return true
  }

  const previousChar = start > 0 ? text[start - 1] : ''
  const nextChar = end < text.length ? text[end] : ''
  return !ASCII_WORD_CHAR.test(previousChar) && !ASCII_WORD_CHAR.test(nextChar)
}
