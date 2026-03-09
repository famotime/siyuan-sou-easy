// @vitest-environment jsdom

import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest'

import {
  collectSearchableBlocks,
  createEditorContextFromElement,
  getBlockPlainText,
} from '@/features/search-replace/editor'
import type { SearchOptions } from '@/features/search-replace/types'

const defaultOptions: SearchOptions = {
  includeCodeBlock: false,
  matchCase: false,
  selectionOnly: false,
  useRegex: false,
  wholeWord: false,
}

describe('editor block collection', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('collects only supported searchable blocks and strips attribute text', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-wysiwyg">
          <div data-node-id="block-1" data-type="NodeParagraph">
            <div contenteditable="true">Alpha <span>Beta</span></div>
            <div class="protyle-attr">
              <div contenteditable="true">Hidden attr</div>
            </div>
          </div>
          <div data-node-id="block-2" data-type="NodeCodeBlock">
            <div contenteditable="true">const count = 1</div>
          </div>
          <div data-node-id="block-3" data-type="NodeTable">
            <div contenteditable="true">Skip this block</div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const context = createEditorContextFromElement(protyle)!
    const paragraphBlock = document.querySelector<HTMLElement>('[data-node-id="block-1"]')!

    expect(getBlockPlainText(paragraphBlock)).toBe('Alpha Beta')

    const withoutCodeBlocks = collectSearchableBlocks(context, defaultOptions)
    const withCodeBlocks = collectSearchableBlocks(context, {
      ...defaultOptions,
      includeCodeBlock: true,
    })

    expect(withoutCodeBlocks.map(block => ({
      blockId: block.blockId,
      text: block.text,
    }))).toEqual([
      {
        blockId: 'block-1',
        text: 'Alpha Beta',
      },
    ])
    expect(withCodeBlocks.map(block => block.blockId)).toEqual(['block-1', 'block-2'])
  })
})
