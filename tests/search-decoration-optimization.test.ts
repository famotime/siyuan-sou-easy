// @vitest-environment jsdom

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const { locateTextRange } = vi.hoisted(() => ({
  locateTextRange: vi.fn(),
}))

vi.mock('@/features/search-replace/editor/ranges', () => ({
  locateTextRange,
}))

import { syncSearchDecorations } from '@/features/search-replace/editor'
import type {
  EditorContext,
  SearchMatch,
} from '@/features/search-replace/types'

describe('search decoration optimization', () => {
  beforeEach(() => {
    locateTextRange.mockReset()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    delete (globalThis as typeof globalThis & { Highlight?: unknown }).Highlight
    delete (globalThis as typeof globalThis & { CSS?: { highlights?: Map<string, unknown> } }).CSS
  })

  it('reuses full-match text highlights when only the current match changes', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-wysiwyg">
          <div data-node-id="block-1" data-type="NodeParagraph">
            <div contenteditable="true">Alpha Beta Gamma</div>
          </div>
        </div>
      </div>
    `

    const block = document.querySelector<HTMLElement>('[data-node-id="block-1"]')!
    const context: EditorContext = {
      protyle: document.querySelector('.protyle') as HTMLElement,
      rootId: 'root-1',
      title: 'Doc',
    }
    const matches: SearchMatch[] = [
      createMatch({
        blockId: 'block-1',
        end: 5,
        id: 'block-1:0:5',
        matchedText: 'Alpha',
        previewText: '[Alpha] Beta Gamma',
        start: 0,
      }),
      createMatch({
        blockId: 'block-1',
        end: 10,
        id: 'block-1:6:10',
        matchedText: 'Beta',
        previewText: 'Alpha [Beta] Gamma',
        start: 6,
      }),
    ]

    locateTextRange.mockImplementation((_context: EditorContext, match: SearchMatch) => {
      const textNode = block.querySelector('[contenteditable="true"]')!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, match.start)
      range.setEnd(textNode, match.end)
      return range
    })

    mockCssHighlights()

    syncSearchDecorations(context, matches, matches[0]!)
    syncSearchDecorations(context, matches, matches[1]!)

    expect(locateTextRange).toHaveBeenCalledTimes(2)
  })

  it('skips non-current text highlights for large code blocks when optimization is enabled', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-wysiwyg">
          <div data-node-id="code-1" data-type="NodeCodeBlock">
            <div contenteditable="true">{
"name": "friendly-search",
"items": [
  "alpha",
  "beta",
  "alpha"
]
}</div>
          </div>
        </div>
      </div>
    `

    const block = document.querySelector<HTMLElement>('[data-node-id="code-1"]')!
    const context: EditorContext = {
      protyle: document.querySelector('.protyle') as HTMLElement,
      rootId: 'root-1',
      title: 'Doc',
    }
    const matches: SearchMatch[] = [
      createMatch({
        blockId: 'code-1',
        blockLineCount: 7,
        blockTextLength: 69,
        blockType: 'NodeCodeBlock',
        end: 41,
        id: 'code-1:36:41',
        matchedText: 'alpha',
        previewText: '..."items": ["[alpha]", ...',
        start: 36,
      }),
      createMatch({
        blockId: 'code-1',
        blockLineCount: 7,
        blockTextLength: 69,
        blockType: 'NodeCodeBlock',
        end: 61,
        id: 'code-1:56:61',
        matchedText: 'alpha',
        previewText: '... "beta", "[alpha]" ]...',
        start: 56,
      }),
    ]

    locateTextRange.mockImplementation((_context: EditorContext, match: SearchMatch) => {
      const textNode = block.querySelector('[contenteditable="true"]')!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, match.start)
      range.setEnd(textNode, match.end)
      return range
    })

    const highlights = mockCssHighlights()

    syncSearchDecorations(context, matches, matches[0]!, {
      largeCodeBlockLineThreshold: 5,
      optimizeLargeCodeBlocks: true,
    })

    expect(locateTextRange).toHaveBeenCalledTimes(1)
    expect(highlights.get('sfsr-match')).toBeUndefined()
    expect(highlights.get('sfsr-current-match')?.ranges).toHaveLength(1)
    expect(block.classList.contains('sfsr-block-match')).toBe(true)
    expect(block.classList.contains('sfsr-block-current')).toBe(true)
  })
})

function createMatch(overrides: Partial<SearchMatch>): SearchMatch {
  return {
    blockId: 'block-1',
    blockIndex: 0,
    blockType: 'NodeParagraph',
    end: 0,
    id: 'block-1:0:0',
    matchedText: '',
    previewText: '',
    replaceable: true,
    rootId: 'root-1',
    start: 0,
    ...overrides,
  }
}

function mockCssHighlights() {
  const highlights = new Map<string, { ranges: Range[] }>()
  ;(globalThis as typeof globalThis & {
    Highlight?: new (...ranges: Range[]) => { ranges: Range[] }
  }).Highlight = class {
    ranges: Range[]

    constructor(...ranges: Range[]) {
      this.ranges = ranges
    }
  }
  ;(globalThis as typeof globalThis & {
    CSS?: { highlights?: Map<string, { ranges: Range[] }> }
  }).CSS = {
    highlights,
  }

  return highlights
}
