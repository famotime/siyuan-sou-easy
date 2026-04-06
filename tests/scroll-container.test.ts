// @vitest-environment jsdom

import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { resolveEditorScrollContainer } from '@/features/search-replace/editor/scroll-container'
import type { EditorContext } from '@/features/search-replace/types'

describe('editor scroll container', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('prefers the protyle content container even without explicit overflow styles', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="block-1" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const content = document.querySelector<HTMLElement>('.protyle-content')!
    const wysiwyg = document.querySelector<HTMLElement>('.protyle-wysiwyg')!

    vi.spyOn(content, 'getBoundingClientRect').mockReturnValue({
      bottom: 400,
      height: 300,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 100,
      width: 320,
      x: 0,
      y: 100,
    })
    vi.spyOn(wysiwyg, 'getBoundingClientRect').mockReturnValue({
      bottom: 380,
      height: 240,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 120,
      width: 320,
      x: 0,
      y: 120,
    })

    expect(resolveEditorScrollContainer(createContext(protyle))).toBe(content)
  })

  it('falls back to the wysiwyg root when no content container exists', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-wysiwyg">
          <div data-node-id="block-1" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const wysiwyg = document.querySelector<HTMLElement>('.protyle-wysiwyg')!

    vi.spyOn(wysiwyg, 'getBoundingClientRect').mockReturnValue({
      bottom: 380,
      height: 240,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 120,
      width: 320,
      x: 0,
      y: 120,
    })

    expect(resolveEditorScrollContainer(createContext(protyle))).toBe(wysiwyg)
  })
})

function createContext(protyle: HTMLElement): EditorContext {
  return {
    protyle,
    rootId: 'root-1',
    title: 'Doc 1',
  }
}
