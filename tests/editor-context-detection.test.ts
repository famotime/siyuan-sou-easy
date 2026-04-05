// @vitest-environment jsdom

import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  findEditorContextByRootId,
  getActiveEditorContext,
} from '@/features/search-replace/editor'

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
  it('prefers the active window context over a stale selection when the panel has focus', () => {
    document.title = 'siyuan-plugin-test - 鎬濇簮绗旇 v3.5.7'
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="20260220075025-ue88wkc"></div>
        <div class="protyle-title" data-node-id="20260220075025-ue88wkc"></div>
        <input class="protyle-title__input" value="鏃ф枃妗? />
        <div class="protyle-wysiwyg">
          <div data-node-id="old-block" data-type="NodeParagraph" class="p"><div contenteditable="true">鏃ф枃妗ｉ噷鐨勯€夊尯</div></div>
        </div>
      </div>
      <div class="layout__wnd--active">
        <div class="protyle">
          <div class="protyle-background" data-node-id="20260207090010-i8288q8"></div>
          <div class="protyle-title" data-node-id="20260207090010-i8288q8"></div>
          <input class="protyle-title__input" value="鎼滅储鏇挎崲娴嬭瘯" />
        </div>
      </div>
      <input class="sfsr-input" value="闂" />
    `

    const staleTextNode = document.querySelector('[data-node-id="old-block"] [contenteditable="true"]')?.firstChild
    const range = document.createRange()
    range.setStart(staleTextNode!, 0)
    range.setEnd(staleTextNode!, 1)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)

    document.querySelector<HTMLInputElement>('.sfsr-input')?.focus()

    const context = getActiveEditorContext()

    expect(context?.rootId).toBe('20260207090010-i8288q8')
    expect(context?.title).toBe('鎼滅储鏇挎崲娴嬭瘯')
  })

  it('prefers the visible protyle instance when duplicate root ids exist during transition', () => {
    document.body.innerHTML = `
      <div class="protyle protyle--stale">
        <div class="protyle-background" data-node-id="20251208094107-ztk4cwm"></div>
        <div class="protyle-title" data-node-id="20251208094107-ztk4cwm"></div>
        <input class="protyle-title__input" value="Definition 文档" />
      </div>
      <div class="protyle protyle--visible">
        <div class="protyle-background" data-node-id="20251208094107-ztk4cwm"></div>
        <div class="protyle-title" data-node-id="20251208094107-ztk4cwm"></div>
        <input class="protyle-title__input" value="Definition 文档" />
      </div>
    `

    const [staleProtyle, visibleProtyle] = Array.from(document.querySelectorAll<HTMLElement>('.protyle'))

    vi.spyOn(staleProtyle!, 'getBoundingClientRect').mockReturnValue({
      bottom: -100,
      height: 300,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: -400,
      width: 320,
      x: 0,
      y: -400,
    })
    vi.spyOn(visibleProtyle!, 'getBoundingClientRect').mockReturnValue({
      bottom: 500,
      height: 300,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 200,
      width: 320,
      x: 0,
      y: 200,
    })

    const context = findEditorContextByRootId('20251208094107-ztk4cwm')

    expect(context?.protyle).toBe(visibleProtyle)
    expect(context?.rootId).toBe('20251208094107-ztk4cwm')
  })
})
