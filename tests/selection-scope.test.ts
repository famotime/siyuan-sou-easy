// @vitest-environment jsdom

import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest'

import {
  createEditorContextFromElement,
  getCurrentSelectionScope,
} from '@/features/search-replace/editor'

describe('selection search scope', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    window.getSelection()?.removeAllRanges()
  })

  it('collects per-block text ranges from the current editor selection', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-wysiwyg">
          <div data-node-id="block-1" data-type="NodeParagraph"><div contenteditable="true">alpha beta</div></div>
          <div data-node-id="block-2" data-type="NodeParagraph"><div contenteditable="true">gamma delta</div></div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const firstText = document.querySelector<HTMLElement>('[data-node-id="block-1"] [contenteditable="true"]')?.firstChild
    const secondText = document.querySelector<HTMLElement>('[data-node-id="block-2"] [contenteditable="true"]')?.firstChild
    const range = document.createRange()
    range.setStart(firstText!, 6)
    range.setEnd(secondText!, 5)

    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)

    const context = createEditorContextFromElement(protyle)
    const scope = getCurrentSelectionScope(context!)

    expect(Array.from(scope.entries())).toEqual([
      ['block-1', [{ start: 6, end: 10 }]],
      ['block-2', [{ start: 0, end: 5 }]],
    ])
  })

  it('measures offsets against searchable text when a block has multiple editable roots', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-wysiwyg">
          <div data-node-id="block-1" data-type="NodeParagraph">
            <div contenteditable="true">foo</div>
            <div class="protyle-attr">
              <div contenteditable="true">IGNORED</div>
            </div>
            <div contenteditable="true">bar</div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const targetText = document.querySelectorAll<HTMLElement>('[data-node-id="block-1"] [contenteditable="true"]')[2]?.firstChild
    const range = document.createRange()
    range.setStart(targetText!, 0)
    range.setEnd(targetText!, 3)

    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)

    const context = createEditorContextFromElement(protyle)
    const scope = getCurrentSelectionScope(context!)

    expect(Array.from(scope.entries())).toEqual([
      ['block-1', [{ start: 3, end: 6 }]],
    ])
  })

  it('treats selected blocks as full selection ranges when SiYuan uses block selection classes', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-wysiwyg">
          <div data-node-id="block-1" data-type="NodeParagraph" class="p protyle-wysiwyg--select">
            <div contenteditable="true">alpha beta</div>
          </div>
          <div data-node-id="block-2" data-type="NodeParagraph" class="p protyle-wysiwyg--select">
            <div contenteditable="true">gamma delta</div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const context = createEditorContextFromElement(protyle)
    const scope = getCurrentSelectionScope(context!)

    expect(Array.from(scope.entries())).toEqual([
      ['block-1', [{ start: 0, end: 10 }]],
      ['block-2', [{ start: 0, end: 11 }]],
    ])
  })
})
