// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  collectSearchableBlocks,
  createEditorContextFromElement,
} from '@/features/search-replace/editor'

describe('collectSearchableBlocks', () => {
  it('deduplicates blocks by id and ignores unsupported block types and metadata text', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title">
          <input class="protyle-title__input" value="Doc 1">
        </div>
        <div class="protyle-wysiwyg">
          <div data-node-id="para-1" data-type="NodeParagraph">
            <div contenteditable="true">Alpha</div>
          </div>
          <div data-node-id="para-1" data-type="NodeParagraph">
            <div contenteditable="true">Duplicate Alpha</div>
          </div>
          <div data-node-id="quote-1" data-type="NodeBlockquote">
            <div contenteditable="true">Ignored quote</div>
          </div>
          <div data-node-id="heading-1" data-type="NodeHeading">
            <div class="protyle-attr">
              <div contenteditable="true">Hidden metadata</div>
            </div>
            <div contenteditable="true">Visible Heading</div>
          </div>
        </div>
      </div>
    `

    const context = createEditorContextFromElement(document.querySelector('.protyle') as HTMLElement)
    const blocks = collectSearchableBlocks(context!, {
      includeCodeBlock: false,
      matchCase: false,
      useRegex: false,
      wholeWord: false,
    })

    expect(blocks).toHaveLength(2)
    expect(blocks.map(block => block.blockId)).toEqual(['para-1', 'heading-1'])
    expect(blocks.map(block => block.text)).toEqual(['Alpha', 'Visible Heading'])
  })

  it('includes code blocks only when includeCodeBlock is enabled', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title">
          <input class="protyle-title__input" value="Doc 1">
        </div>
        <div class="protyle-wysiwyg">
          <div data-node-id="para-1" data-type="NodeParagraph">
            <div contenteditable="true">Alpha</div>
          </div>
          <div data-node-id="code-1" data-type="NodeCodeBlock">
            <div contenteditable="true">const foo = 1</div>
          </div>
        </div>
      </div>
    `

    const context = createEditorContextFromElement(document.querySelector('.protyle') as HTMLElement)

    const blocksWithoutCode = collectSearchableBlocks(context!, {
      includeCodeBlock: false,
      matchCase: false,
      useRegex: false,
      wholeWord: false,
    })
    const blocksWithCode = collectSearchableBlocks(context!, {
      includeCodeBlock: true,
      matchCase: false,
      useRegex: false,
      wholeWord: false,
    })

    expect(blocksWithoutCode.map(block => block.blockId)).toEqual(['para-1'])
    expect(blocksWithCode.map(block => block.blockId)).toEqual(['para-1', 'code-1'])
    expect(blocksWithCode[1]?.text).toBe('const foo = 1')
  })
})
