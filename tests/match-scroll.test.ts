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

  it('scrolls the matched table cell instead of the whole table when the cell is outside the visible range', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="table-1" data-type="NodeTable" class="table">
              <div class="table__row">
                <div data-node-id="cell-1" data-type="NodeTableCell" class="table__cell">
                  <div contenteditable="true">Cell Alpha</div>
                </div>
                <div data-node-id="cell-2" data-type="NodeTableCell" class="table__cell">
                  <div contenteditable="true">Cell Beta</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const container = document.querySelector<HTMLElement>('.protyle-content')!
    const tableBlock = document.querySelector<HTMLElement>('[data-node-id="table-1"]')!
    const targetCell = document.querySelector<HTMLElement>('[data-node-id="cell-2"]')!
    const tableScrollSpy = vi.fn()
    const cellScrollSpy = vi.fn()
    tableBlock.scrollIntoView = tableScrollSpy
    targetCell.scrollIntoView = cellScrollSpy

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
    vi.spyOn(tableBlock, 'getBoundingClientRect').mockReturnValue({
      bottom: 360,
      height: 220,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 140,
      width: 320,
      x: 0,
      y: 140,
    })
    vi.spyOn(targetCell, 'getBoundingClientRect').mockReturnValue({
      bottom: 520,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 480,
      width: 320,
      x: 0,
      y: 480,
    })

    const result = scrollMatchIntoView(protyleContext(protyle), {
      blockId: 'table-1',
      blockIndex: 0,
      blockType: 'NodeTable',
      end: 19,
      id: 'table-1:15:19',
      matchedText: 'Beta',
      previewText: 'Cell AlphaCell [Beta]',
      replaceable: true,
      rootId: 'root-1',
      start: 15,
    }, 'if-needed')

    expect(result).toBe('scrolled')
    expect(cellScrollSpy).toHaveBeenCalledTimes(1)
    expect(tableScrollSpy).not.toHaveBeenCalled()
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
    context: protyleContext(protyle),
  }
}

function protyleContext(protyle: HTMLElement): EditorContext {
  return {
    protyle,
    rootId: 'root-1',
    title: 'Doc 1',
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
