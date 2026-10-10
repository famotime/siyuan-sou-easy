// @vitest-environment jsdom

import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  createEditorContextFromElement,
  getCurrentSelectionScope,
} from '@/features/search-replace/editor'
import type { SelectionScope } from '@/features/search-replace/types'

// Cost guard for the selection scan that runs on every `selectionchange` (every
// keystroke and every caret move). The scan must stay proportional to the selection
// instead of to the document, so these tests count the DOM work it performs rather
// than measuring wall-clock time: counts are deterministic, timings are not.
interface ScanCost {
  comparePoints: number
  ranges: number
  scope: SelectionScope
  textWalks: number
}

const PROLOGUE = `
  <div class="protyle-background" data-node-id="root-1"></div>
  <div class="protyle-title" data-node-id="root-1"></div>
  <input class="protyle-title__input" value="Doc 1" />
`

function buildListDocument(blockCount: number) {
  document.body.innerHTML = `
    <div class="protyle">
      ${PROLOGUE}
      <div class="protyle-wysiwyg">
        ${Array.from({ length: blockCount }, (_, index) => `
          <div data-node-id="block-${index}" data-type="NodeListItem">
            <div class="protyle-action"></div>
            <div contenteditable="true">列表项 ${index} 的正文内容</div>
          </div>`).join('')}
      </div>
    </div>
  `

  return document.querySelector<HTMLElement>('.protyle')!
}

function textNodeOf(blockId: string) {
  const editable = document.querySelector<HTMLElement>(`[data-node-id="${blockId}"] [contenteditable="true"]`)
  return editable!.firstChild as Text
}

function selectRange(startNode: Text, start: number, endNode: Text, end: number) {
  const range = document.createRange()
  range.setStart(startNode, start)
  range.setEnd(endNode, end)

  const selection = window.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
}

function measureScan(protyle: HTMLElement): ScanCost {
  // jsdom's selector engine also creates tree walkers, so count text walks only.
  const treeWalkerSpy = vi.spyOn(document, 'createTreeWalker')
  const rangeSpy = vi.spyOn(document, 'createRange')
  const comparePointSpy = vi.spyOn(Range.prototype as unknown as { comparePoint: () => number }, 'comparePoint')

  try {
    const context = createEditorContextFromElement(protyle)
    const scope = getCurrentSelectionScope(context!)

    return {
      comparePoints: comparePointSpy.mock.calls.length,
      ranges: rangeSpy.mock.calls.length,
      scope,
      textWalks: treeWalkerSpy.mock.calls.filter(call => call[1] === NodeFilter.SHOW_TEXT).length,
    }
  } finally {
    vi.restoreAllMocks()
  }
}

describe('selection scope scan cost', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    window.getSelection()?.removeAllRanges()
    vi.restoreAllMocks()
  })

  it('keeps a collapsed caret off the document entirely', () => {
    const protyle = buildListDocument(2000)
    const caret = textNodeOf('block-1000')
    selectRange(caret, 4, caret, 4)

    const cost = measureScan(protyle)

    expect(cost.textWalks).toBe(0)
    expect(cost.comparePoints).toBe(0)
    expect(cost.ranges).toBe(0)
    expect(cost.scope.size).toBe(0)
  })

  it('scans a single block for an in-block selection whatever the document size', () => {
    const smallProtyle = buildListDocument(100)
    selectRange(textNodeOf('block-50'), 4, textNodeOf('block-50'), 8)
    const small = measureScan(smallProtyle)

    const largeProtyle = buildListDocument(2000)
    selectRange(textNodeOf('block-1000'), 4, textNodeOf('block-1000'), 8)
    const large = measureScan(largeProtyle)

    expect(large.textWalks).toBe(small.textWalks)
    expect(large.ranges).toBe(small.ranges)
    expect(large.textWalks).toBeLessThanOrEqual(3)
    expect(large.comparePoints).toBeLessThanOrEqual(4)
    expect(Array.from(large.scope.entries())).toEqual([
      ['block-1000', [{ start: 4, end: 8 }]],
    ])
  })

  it('scans the selected span for a cross-block selection whatever the document size', () => {
    const smallProtyle = buildListDocument(100)
    selectRange(textNodeOf('block-50'), 3, textNodeOf('block-52'), 5)
    const small = measureScan(smallProtyle)

    const largeProtyle = buildListDocument(2000)
    selectRange(textNodeOf('block-1000'), 3, textNodeOf('block-1002'), 5)
    const large = measureScan(largeProtyle)

    // Three selected blocks cost three blocks, not the 2000 of the document.
    expect(large.textWalks).toBe(small.textWalks)
    expect(large.ranges).toBe(small.ranges)
    expect(large.textWalks).toBeLessThanOrEqual(5)
    expect(large.comparePoints).toBeLessThanOrEqual(8)
    expect(large.scope.size).toBe(3)
    expect(large.scope.has('block-1001')).toBe(true)
  })

  it('scans the selected span when the selection ends inside a block that has nested blocks', () => {
    const protyle = buildListDocument(500)
    document.querySelector<HTMLElement>('[data-node-id="block-250"] .protyle-action')!
      .insertAdjacentHTML('afterend', `
        <div data-node-id="nested-250" data-type="NodeParagraph">
          <div contenteditable="true">子段落内容</div>
        </div>
      `)

    // Ends in the block's attribute area, which sits after the nested block.
    const attr = document.createElement('div')
    attr.className = 'protyle-attr'
    attr.innerHTML = '<div contenteditable="true">属性文本</div>'
    document.querySelector<HTMLElement>('[data-node-id="block-250"]')!.appendChild(attr)

    const attrText = attr.firstElementChild!.firstChild as Text
    selectRange(textNodeOf('block-248'), 2, attrText, 2)

    const cost = measureScan(protyle)

    expect(cost.scope.has('nested-250')).toBe(true)
    expect(cost.scope.has('block-250')).toBe(true)
    expect(cost.comparePoints).toBeLessThanOrEqual(10)
  })

  it('keeps a table-cell selection bounded by the table around it', () => {
    document.body.innerHTML = `
      <div class="protyle">
        ${PROLOGUE}
        <div class="protyle-wysiwyg">
          ${Array.from({ length: 500 }, (_, index) => `
            <div data-node-id="block-${index}" data-type="NodeListItem">
              <div contenteditable="true">列表项 ${index} 的正文内容</div>
            </div>`).join('')}
          <div data-node-id="block-table" data-type="NodeTable">
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
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    selectRange(textNodeOf('cell-1'), 5, textNodeOf('cell-1'), 10)

    const cost = measureScan(protyle)

    expect(cost.textWalks).toBeLessThanOrEqual(4)
    expect(cost.comparePoints).toBeLessThanOrEqual(8)
    expect(cost.scope.has('block-table')).toBe(true)
  })
})
