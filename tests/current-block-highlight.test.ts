// @vitest-environment jsdom

import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest'

import { syncSearchDecorations } from '@/features/search-replace/editor'
import type { EditorContext, SearchMatch } from '@/features/search-replace/types'

describe('current block highlight', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    delete (globalThis as typeof globalThis & { Highlight?: unknown }).Highlight
    delete (globalThis as typeof globalThis & { CSS?: { highlights?: Map<string, unknown> } }).CSS
  })

  it('keeps the current block class even when text highlights are supported', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-wysiwyg">
          <div data-node-id="block-1" data-type="NodeParagraph" class="p">
            <div contenteditable="true">飞书配置飞书</div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector('.protyle') as HTMLElement
    const context: EditorContext = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    const match: SearchMatch = {
      blockId: 'block-1',
      blockIndex: 0,
      blockType: 'NodeParagraph',
      end: 2,
      id: 'block-1:0:2',
      matchedText: '飞书',
      previewText: '[飞书]配置飞书',
      replaceable: true,
      rootId: 'root-1',
      start: 0,
    }

    ;(globalThis as typeof globalThis & { Highlight?: new (...ranges: Range[]) => unknown }).Highlight = class {
      constructor(..._ranges: Range[]) {}
    }
    ;(globalThis as typeof globalThis & { CSS?: { highlights?: Map<string, unknown> } }).CSS = {
      highlights: new Map(),
    }

    syncSearchDecorations(context, [match], match)

    expect(protyle.querySelector('[data-node-id="block-1"]')?.classList.contains('sfsr-block-current')).toBe(true)
  })

  it('applies highlight classes to the actual heading block when metadata with the same node id exists', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-wysiwyg">
          <div class="protyle-attr" data-node-id="heading-1"></div>
          <div data-node-id="heading-1" data-type="NodeHeading" class="h1">
            <div contenteditable="true">问题标题</div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector('.protyle') as HTMLElement
    const headingBlock = protyle.querySelector<HTMLElement>('[data-node-id="heading-1"][data-type="NodeHeading"]')
    const context: EditorContext = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    const match: SearchMatch = {
      blockId: 'heading-1',
      blockIndex: 0,
      blockType: 'NodeHeading',
      end: 2,
      id: 'heading-1:0:2',
      matchedText: '问题',
      previewText: '[问题]标题',
      replaceable: true,
      rootId: 'root-1',
      start: 0,
    }

    syncSearchDecorations(context, [match], match)

    expect(headingBlock?.classList.contains('sfsr-block-match')).toBe(true)
    expect(headingBlock?.classList.contains('sfsr-block-current')).toBe(true)
  })

  it('adds block and cell highlight classes for attribute view matches when the cell can be located', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-wysiwyg">
          <div data-node-id="av-block-1" data-type="NodeAttributeView" class="av" data-av-id="av-1" data-render="true">
            <div class="av__row av__row--header">
              <div class="av__body">
                <div class="av__cell av__cell--header"><div class="av__celltext">电影</div></div>
                <div class="av__cell av__cell--header"><div class="av__celltext">导演</div></div>
              </div>
            </div>
            <div class="av__row" data-id="item-1">
              <div class="av__body">
                <div class="av__cell"><div class="av__celltext" data-dtype="block">热辣滚烫</div></div>
                <div class="av__cell"><div class="av__celltext">贾玲</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector('.protyle') as HTMLElement
    const context: EditorContext = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    const match: SearchMatch = {
      attributeView: {
        avBlockId: 'av-block-1',
        avID: 'av-1',
        columnName: '电影',
        columnIndex: 0,
        itemID: 'item-1',
        keyID: 'col-1',
        rowID: 'item-1',
      },
      blockId: 'av-block-1',
      blockIndex: 0,
      blockType: 'NodeAttributeView',
      end: 4,
      id: 'av:av-block-1:item-1:col-1:0:4',
      matchedText: '热辣滚烫',
      previewText: '电影: [热辣滚烫]',
      replaceable: false,
      rootId: 'root-1',
      sourceKind: 'attribute-view',
      start: 0,
    }

    const highlights = new Map<string, { ranges: Range[] }>()
    ;(globalThis as typeof globalThis & { Highlight?: new (...ranges: Range[]) => { ranges: Range[] } }).Highlight = class {
      ranges: Range[]

      constructor(...ranges: Range[]) {
        this.ranges = ranges
      }
    }
    ;(globalThis as typeof globalThis & { CSS?: { highlights?: Map<string, { ranges: Range[] }> } }).CSS = {
      highlights,
    }

    syncSearchDecorations(context, [match], match)

    expect(protyle.querySelector('[data-node-id="av-block-1"]')?.classList.contains('sfsr-block-match')).toBe(true)
    expect(protyle.querySelector('[data-node-id="av-block-1"]')?.classList.contains('sfsr-block-current')).toBe(true)
    expect(protyle.querySelector('.av__row[data-id="item-1"] .av__body > .av__cell')?.classList.contains('sfsr-av-cell-match')).toBe(true)
    expect(protyle.querySelector('.av__row[data-id="item-1"] .av__body > .av__cell')?.classList.contains('sfsr-av-cell-current')).toBe(true)
    expect(highlights.get('sfsr-match')?.ranges.map(range => range.toString())).toContain('热辣滚烫')
    expect(highlights.get('sfsr-current-match')?.ranges.map(range => range.toString())).toContain('热辣滚烫')
  })

  it('highlights the matched table cell instead of the whole table when text highlights are unavailable', () => {
    document.body.innerHTML = `
      <div class="protyle">
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
    `

    const protyle = document.querySelector('.protyle') as HTMLElement
    const tableBlock = protyle.querySelector<HTMLElement>('[data-node-id="table-1"]')
    const targetCell = protyle.querySelector<HTMLElement>('[data-node-id="cell-2"]')
    const context: EditorContext = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    const match: SearchMatch = {
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
    }

    syncSearchDecorations(context, [match], match)

    expect(tableBlock?.classList.contains('sfsr-block-match')).toBe(false)
    expect(tableBlock?.classList.contains('sfsr-block-current')).toBe(false)
    expect(targetCell?.classList.contains('sfsr-av-cell-match')).toBe(true)
    expect(targetCell?.classList.contains('sfsr-av-cell-current')).toBe(true)
  })
})
