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

import { clearSearchDecorations, syncSearchDecorations } from '@/features/search-replace/editor'
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
        start: 0, occ: 0,
      }),
      createMatch({
        blockId: 'block-1',
        end: 10,
        id: 'block-1:6:10',
        matchedText: 'Beta',
        previewText: 'Alpha [Beta] Gamma',
        start: 6, occ: 0,
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
        start: 36, occ: 0,
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
        start: 56, occ: 0,
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

  it('invalidates cached text highlights after in-place text edits', () => {
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
    // 注意：跨刷新复用同一个 matches 数组引用（与 search-controller 中
    // state.matches 在两次搜索之间的行为一致），这是过期缓存命中的前提。
    const matches: SearchMatch[] = [
      createMatch({
        blockId: 'block-1',
        end: 5,
        id: 'block-1:0:5',
        matchedText: 'Alpha',
        previewText: '[Alpha] Beta Gamma',
        start: 0, occ: 0,
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
    expect(locateTextRange).toHaveBeenCalledTimes(1)

    // 未编辑时同引用复用缓存，不重新定位
    syncSearchDecorations(context, matches, matches[0]!)
    expect(locateTextRange).toHaveBeenCalledTimes(1)

    // 模拟 SiYuan 原地编辑：直接改写 Text.nodeValue，节点保持 connected，
    // 旧的连接性失效谓词检测不到这种变化
    const textNode = block.querySelector('[contenteditable="true"]')!.firstChild as Text
    textNode.data = `x${textNode.data}`

    syncSearchDecorations(context, matches, matches[0]!)
    // 内容指纹校验发现 Range 文本已不再等于 matchedText → 缓存失效并重新定位
    expect(locateTextRange).toHaveBeenCalledTimes(2)
  })

  it('keeps another editor\'s text highlights when clearing one editor', () => {
    document.body.innerHTML = `
      <div class="protyle" id="protyle-a">
        <div class="protyle-wysiwyg">
          <div data-node-id="block-a" data-type="NodeParagraph">
            <div contenteditable="true">Alpha Beta Gamma</div>
          </div>
        </div>
      </div>
      <div class="protyle" id="protyle-b">
        <div class="protyle-wysiwyg">
          <div data-node-id="block-b" data-type="NodeParagraph">
            <div contenteditable="true">Delta Epsilon</div>
          </div>
        </div>
      </div>
    `

    const contextA: EditorContext = {
      protyle: document.querySelector('#protyle-a') as HTMLElement,
      rootId: 'root-a',
      title: 'Doc A',
    }
    const contextB: EditorContext = {
      protyle: document.querySelector('#protyle-b') as HTMLElement,
      rootId: 'root-b',
      title: 'Doc B',
    }
    const matchesA: SearchMatch[] = [
      createMatch({
        blockId: 'block-a',
        end: 5,
        id: 'block-a:0:5',
        matchedText: 'Alpha',
        previewText: '[Alpha] Beta Gamma',
        start: 0, occ: 0,
      }),
    ]

    locateTextRange.mockImplementation((_context: EditorContext, match: SearchMatch) => {
      const host = document.querySelector<HTMLElement>(`[data-node-id="${match.blockId}"]`)!
      const textNode = host.querySelector('[contenteditable="true"]')!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, match.start)
      range.setEnd(textNode, match.end)
      return range
    })

    const highlights = mockCssHighlights()

    syncSearchDecorations(contextA, matchesA, matchesA[0]!)
    expect(highlights.has('sfsr-match')).toBe(true)

    // 清除编辑器 B（其自身从未注册文本高亮）时，不应擦掉编辑器 A 的全局文本高亮
    clearSearchDecorations(contextB)
    expect(highlights.has('sfsr-match')).toBe(true)
    expect(highlights.has('sfsr-current-match')).toBe(true)

    // 清除编辑器 A 时正常删除
    clearSearchDecorations(contextA)
    expect(highlights.has('sfsr-match')).toBe(false)
    expect(highlights.has('sfsr-current-match')).toBe(false)
  })

  it('falls back to block-level markers when text highlight api is unavailable', () => {
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
        start: 0, occ: 0,
      }),
    ]

    locateTextRange.mockImplementation((_context: EditorContext, match: SearchMatch) => {
      const textNode = block.querySelector('[contenteditable="true"]')!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, match.start)
      range.setEnd(textNode, match.end)
      return range
    })

    // 不 mock CSS.highlights / Highlight：模拟不支持 CSS Custom Highlight 的环境
    syncSearchDecorations(context, matches, matches[0]!)

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
    start: 0, occ: 0,
    ...overrides,
  }
}

function mockCssHighlights() {
  const highlights = new Map<string, { ranges: Range[] }>()
  // lib.dom 已声明全局 Highlight/CSS，交叉断言会把属性类型并成 typeof Highlight & stub；经 unknown 双重断言用桩形状覆盖
  ;(globalThis as unknown as {
    Highlight?: new (...ranges: Range[]) => { ranges: Range[] }
  }).Highlight = class {
    ranges: Range[]

    constructor(...ranges: Range[]) {
      this.ranges = ranges
    }
  }
  ;(globalThis as unknown as {
    CSS?: { highlights?: Map<string, { ranges: Range[] }> }
  }).CSS = {
    highlights,
  }

  return highlights
}
