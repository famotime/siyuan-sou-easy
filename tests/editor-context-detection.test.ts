// @vitest-environment jsdom

import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest'

import { getActiveEditorContext } from '@/features/search-replace/editor'

describe('editor context detection', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    document.title = ''
    window.getSelection()?.removeAllRanges()
  })

  it('prefers the visible editor matching the current page title', () => {
    document.title = '搜索替换测试 - siyuan-plugin-test - 思源笔记 v3.5.7'
    document.body.innerHTML = `
      <div class="layout__wnd--active">
        <div class="protyle">
          <div class="protyle-background" data-node-id="root-other"></div>
          <div class="protyle-title" data-node-id="root-other"></div>
          <input class="protyle-title__input" value="其他文档" />
        </div>
      </div>
      <div class="protyle">
        <div class="protyle-background" data-node-id="20260207090010-i8288q8"></div>
        <div class="protyle-title" data-node-id="20260207090010-i8288q8"></div>
        <input class="protyle-title__input" value="搜索替换测试" />
      </div>
    `

    const context = getActiveEditorContext()

    expect(context?.rootId).toBe('20260207090010-i8288q8')
    expect(context?.title).toBe('搜索替换测试')
  })

  it('does not let a stale selection from another document override the current page title', () => {
    document.title = '搜索替换测试 - siyuan-plugin-test - 思源笔记 v3.5.7'
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="20260220075025-ue88wkc"></div>
        <div class="protyle-title" data-node-id="20260220075025-ue88wkc"></div>
        <input class="protyle-title__input" value="旧文档" />
        <div class="protyle-wysiwyg">
          <div data-node-id="old-block" data-type="NodeParagraph" class="p"><div contenteditable="true">旧文档里的选区</div></div>
        </div>
      </div>
      <div class="protyle">
        <div class="protyle-background" data-node-id="20260207090010-i8288q8"></div>
        <div class="protyle-title" data-node-id="20260207090010-i8288q8"></div>
        <input class="protyle-title__input" value="搜索替换测试" />
      </div>
    `

    const staleTextNode = document.querySelector('[data-node-id="old-block"] [contenteditable="true"]')?.firstChild
    const range = document.createRange()
    range.setStart(staleTextNode!, 0)
    range.setEnd(staleTextNode!, 1)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)

    const context = getActiveEditorContext()

    expect(context?.rootId).toBe('20260207090010-i8288q8')
    expect(context?.title).toBe('搜索替换测试')
  })
})
