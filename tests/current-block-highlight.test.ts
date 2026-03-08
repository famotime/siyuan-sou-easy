// @vitest-environment jsdom

import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest'

import { syncSearchDecorations } from '@/features/search-replace/editor'
import type { EditorContext, SearchMatch } from '@/features/search-replace/types'

describe('current block highlight', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    delete (globalThis as typeof globalThis & { Highlight?: unknown }).Highlight
    delete (globalThis as typeof globalThis & { CSS?: { highlights?: Map<string, unknown> } }).CSS
  })

  it('keeps the current block class even when text highlights are supported', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-wysiwyg">
          <div data-node-id="block-1" data-type="NodeParagraph" class="p">
            <div contenteditable="true">飞书配置飞书</div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector('.protyle') as HTMLElement
    const context: EditorContext = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    const match: SearchMatch = {
      blockId: 'block-1',
      blockIndex: 0,
      blockType: 'NodeParagraph',
      end: 2,
      id: 'block-1:0:2',
      matchedText: '飞书',
      previewText: '[飞书]配置飞书',
      replaceable: true,
      rootId: 'root-1',
      start: 0,
    }

    ;(globalThis as typeof globalThis & { Highlight?: new (...ranges: Range[]) => unknown }).Highlight = class {
      constructor(..._ranges: Range[]) {}
    }
    ;(globalThis as typeof globalThis & { CSS?: { highlights?: Map<string, unknown> } }).CSS = {
      highlights: new Map(),
    }

    syncSearchDecorations(context, [match], match)

    expect(protyle.querySelector('[data-node-id="block-1"]')?.classList.contains('sfsr-block-current')).toBe(true)
  })
})
