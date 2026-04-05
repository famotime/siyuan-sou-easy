// @vitest-environment jsdom

import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest'

import { locateTextRange } from '@/features/search-replace/editor/ranges'
import type {
  EditorContext,
  SearchMatch,
} from '@/features/search-replace/types'

describe('range location', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('falls back to the nearest matching text when live offsets drift beyond the block text length', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-wysiwyg">
          <div data-node-id="block-1" data-type="NodeParagraph">
            <div contenteditable="true">Definition alpha Definition beta</div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const context: EditorContext = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    const match: SearchMatch = {
      blockId: 'block-1',
      blockIndex: 0,
      blockType: 'NodeParagraph',
      end: 41,
      id: 'block-1:31:41',
      matchedText: 'Definition',
      previewText: '...alpha [Definition] beta',
      replaceable: true,
      rootId: 'root-1',
      start: 31,
    }

    const range = locateTextRange(context, match)

    expect(range).not.toBeNull()
    expect(range?.toString()).toBe('Definition')
    expect(range?.startOffset).toBe(17)
    expect(range?.endOffset).toBe(27)
  })
})
