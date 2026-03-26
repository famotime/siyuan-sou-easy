import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/features/search-replace/editor', () => ({
  buildPreview: (text: string, start: number, end: number) => `${text.slice(0, start)}[${text.slice(start, end)}]${text.slice(end)}`,
  isRangeReplaceable: () => true,
}))

import { findMatches } from '@/features/search-replace/search-engine'
import type { SearchOptions, SearchableBlock } from '@/features/search-replace/types'

const defaultOptions = {
  includeCodeBlock: false,
  matchCase: false,
  searchAttributeView: false,
  selectionOnly: false,
  useRegex: false,
  wholeWord: false,
} as SearchOptions & { selectionOnly: boolean }

function createBlock(text: string, blockIndex = 0): SearchableBlock {
  return {
    blockId: `block-${blockIndex}`,
    rootId: 'root-1',
    blockType: 'NodeParagraph',
    blockIndex,
    text,
    element: {} as HTMLElement,
  }
}

function createTableBlock(text: string): SearchableBlock {
  return {
    blockId: 'table-1',
    rootId: 'root-1',
    blockType: 'NodeTable',
    blockIndex: 0,
    text,
    element: {} as HTMLElement,
    table: {
      cells: [
        {
          cellId: 'cell-1',
          rowIndex: 0,
          columnIndex: 0,
          start: 0,
          end: 10,
        },
        {
          cellId: 'cell-2',
          rowIndex: 1,
          columnIndex: 0,
          start: 10,
          end: text.length,
        },
      ],
      columnCount: 1,
      rowCount: 2,
    },
  } as SearchableBlock
}

describe('findMatches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ordered matches across blocks', () => {
    const result = findMatches([
      createBlock('foo bar', 0),
      createBlock('bar foo foo', 1),
    ], 'foo', defaultOptions)

    expect(result.error).toBe('')
    expect(result.matches.map(match => ({
      blockId: match.blockId,
      blockIndex: match.blockIndex,
      matchedText: match.matchedText,
      start: match.start,
      end: match.end,
    }))).toEqual([
      {
        blockId: 'block-0',
        blockIndex: 0,
        matchedText: 'foo',
        start: 0,
        end: 3,
      },
      {
        blockId: 'block-1',
        blockIndex: 1,
        matchedText: 'foo',
        start: 4,
        end: 7,
      },
      {
        blockId: 'block-1',
        blockIndex: 1,
        matchedText: 'foo',
        start: 8,
        end: 11,
      },
    ])
  })

  it('filters non-whole-word matches when enabled', () => {
    const result = findMatches([
      createBlock('foobar foo _foo foo_', 0),
    ], 'foo', {
      ...defaultOptions,
      wholeWord: true,
    })

    expect(result.error).toBe('')
    expect(result.matches.map(match => match.start)).toEqual([7])
  })

  it('returns an error for invalid regex input', () => {
    const result = findMatches([
      createBlock('foo', 0),
    ], '([', {
      ...defaultOptions,
      useRegex: true,
    })

    expect(result.matches).toEqual([])
    expect(result.error).not.toBe('')
  })

  it('limits matches to the selected text ranges when selection-only mode is enabled', () => {
    const result = (findMatches as any)([
      createBlock('foo bar foo baz', 0),
      createBlock('foo bar', 1),
    ], 'foo', {
      ...defaultOptions,
      selectionOnly: true,
    }, new Map([
      ['block-0', [{ start: 4, end: 11 }]],
      ['block-1', [{ start: 0, end: 3 }]],
    ]))

    expect(result.error).toBe('')
    expect(result.matches.map((match: any) => ({
      blockId: match.blockId,
      start: match.start,
      end: match.end,
    }))).toEqual([
      {
        blockId: 'block-0',
        start: 8,
        end: 11,
      },
      {
        blockId: 'block-1',
        start: 0,
        end: 3,
      },
    ])
  })

  it('attaches table cell metadata to matches so large-table navigation can target the exact row', () => {
    const result = findMatches([
      createTableBlock('Cell AlphaCell Beta'),
    ], 'Beta', defaultOptions)

    expect(result.error).toBe('')
    expect(result.matches).toHaveLength(1)
    expect((result.matches[0] as any).table).toEqual({
      cellEnd: 19,
      cellId: 'cell-2',
      cellStart: 10,
      columnCount: 1,
      columnIndex: 0,
      rowCount: 2,
      rowIndex: 1,
    })
  })
})
