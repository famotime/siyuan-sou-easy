// @vitest-environment jsdom

import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { scrollMatchIntoView } from '@/features/search-replace/editor'
import type {
  EditorContext,
  SearchMatch,
} from '@/features/search-replace/types'

describe('match scrolling', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('does not scroll when the current match is already visible and scrolling is if-needed', () => {
    const { block, context } = setupEditor()
    const scrollSpy = vi.fn()
    block.scrollIntoView = scrollSpy

    vi.spyOn(block, 'getBoundingClientRect').mockReturnValue({
      bottom: 260,
      height: 40,
      left: 0,
      right: 300,
      toJSON: () => ({}),
      top: 220,
      width: 300,
      x: 0,
      y: 220,
    })

    ;(scrollMatchIntoView as any)(context, createMatch(), 'if-needed')

    expect(scrollSpy).not.toHaveBeenCalled()
  })

  it('scrolls when the current match is outside the visible range and scrolling is if-needed', () => {
    const { block, context } = setupEditor()
    const scrollSpy = vi.fn()
    block.scrollIntoView = scrollSpy

    vi.spyOn(block, 'getBoundingClientRect').mockReturnValue({
      bottom: 520,
      height: 40,
      left: 0,
      right: 300,
      toJSON: () => ({}),
      top: 480,
      width: 300,
      x: 0,
      y: 480,
    })

    ;(scrollMatchIntoView as any)(context, createMatch(), 'if-needed')

    expect(scrollSpy).toHaveBeenCalledTimes(1)
  })

  it('reports missing when the target block has not been loaded into the editor DOM yet', () => {
    const { context } = setupEditor()
    document.querySelector('[data-node-id="block-1"]')?.remove()

    const result = scrollMatchIntoView(context, createMatch(), 'if-needed')

    expect(result).toBe('missing')
  })
})

function setupEditor(): { block: HTMLElement, context: EditorContext } {
  document.body.innerHTML = `
    <div class="protyle">
      <div class="protyle-background" data-node-id="root-1"></div>
      <div class="protyle-title" data-node-id="root-1"></div>
      <input class="protyle-title__input" value="Doc 1" />
      <div class="protyle-content">
        <div class="protyle-wysiwyg">
          <div data-node-id="block-1" data-type="NodeParagraph"><div contenteditable="true">foo bar</div></div>
        </div>
      </div>
    </div>
  `

  const protyle = document.querySelector<HTMLElement>('.protyle')!
  const container = document.querySelector<HTMLElement>('.protyle-content')!
  const block = document.querySelector<HTMLElement>('[data-node-id="block-1"]')!

  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
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

  return {
    block,
    context: {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    },
  }
}

function createMatch(): SearchMatch {
  return {
    blockId: 'block-1',
    blockIndex: 0,
    blockType: 'NodeParagraph',
    end: 3,
    id: 'block-1:0:3',
    matchedText: 'foo',
    previewText: '[foo] bar',
    replaceable: true,
    rootId: 'root-1',
    start: 0,
  }
}
