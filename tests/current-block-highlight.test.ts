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

  it('highlights readonly block text when CSS highlights are supported', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-wysiwyg">
          <div data-node-id="block-readonly" data-type="NodeParagraph" class="p">
            <div contenteditable="false">
              <span>本馆创编学生国学丛书</span>
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
      blockId: 'block-readonly',
      blockIndex: 0,
      blockType: 'NodeParagraph',
      end: 8,
      id: 'block-readonly:6:8',
      matchedText: '学生',
      previewText: '本馆创编[学生]国学丛书',
      replaceable: false,
      rootId: 'root-1',
      start: 6,
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

    expect(protyle.querySelector('[data-node-id="block-readonly"]')?.classList.contains('sfsr-block-current')).toBe(true)
    expect(highlights.get('sfsr-match')?.ranges.map(range => range.toString())).toContain('学生')
    expect(highlights.get('sfsr-current-match')?.ranges.map(range => range.toString())).toContain('学生')
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

  it('highlights the matched attribute view header cell when the match comes from a column title', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-wysiwyg">
          <div data-node-id="av-block-header" data-type="NodeAttributeView" class="av" data-av-id="av-1" data-render="true">
            <div class="av__row av__row--header">
              <div class="av__body">
                <div class="av__cell av__cell--header"><div class="av__celltext">电影</div></div>
                <div class="av__cell av__cell--header"><div class="av__celltext">导演</div></div>
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
        avBlockId: 'av-block-header',
        avID: 'av-1',
        columnName: '导演',
        columnIndex: 1,
        keyID: 'col-2',
        targetKind: 'column-header',
      },
      blockId: 'av-block-header',
      blockIndex: 0,
      blockType: 'NodeAttributeView',
      end: 2,
      id: 'av:av-block-header:header:col-2:0:2',
      matchedText: '导演',
      previewText: '[导演]',
      replaceable: false,
      rootId: 'root-1',
      sourceKind: 'attribute-view',
      start: 0,
    }

    syncSearchDecorations(context, [match], match)

    const headerCells = protyle.querySelectorAll<HTMLElement>('.av__row--header .av__cell')
    expect(headerCells[0]?.classList.contains('sfsr-av-cell-match')).toBe(false)
    expect(headerCells[1]?.classList.contains('sfsr-av-cell-match')).toBe(true)
    expect(headerCells[1]?.classList.contains('sfsr-av-cell-current')).toBe(true)
  })

  it('highlights the matched kanban card field when the row uses a card layout instead of table cells', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-wysiwyg">
          <div data-node-id="av-block-card" data-type="NodeAttributeView" class="av" data-av-id="av-card" data-render="true">
            <div class="av__gallery-item" data-id="item-card-1">
              <div class="av__card-body">
                <div class="av__card-field" data-key-id="col-title">
                  <div class="av__celltext">看板里的传感器卡片</div>
                </div>
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
        avBlockId: 'av-block-card',
        avID: 'av-card',
        columnName: '标题',
        columnIndex: 0,
        itemID: 'item-card-1',
        keyID: 'col-title',
        rowID: 'item-card-1',
      },
      blockId: 'av-block-card',
      blockIndex: 0,
      blockType: 'NodeAttributeView',
      end: 4,
      id: 'av:av-block-card:item-card-1:col-title:4:8',
      matchedText: '传感器卡片',
      previewText: '标题: 看板里的[传感器卡片]',
      replaceable: false,
      rootId: 'root-1',
      sourceKind: 'attribute-view',
      start: 4,
    }

    syncSearchDecorations(context, [match], match)

    expect(protyle.querySelector('[data-node-id="av-block-card"]')?.classList.contains('sfsr-block-match')).toBe(true)
    expect(protyle.querySelector('[data-key-id="col-title"]')?.classList.contains('sfsr-av-cell-match')).toBe(true)
    expect(protyle.querySelector('[data-key-id="col-title"]')?.classList.contains('sfsr-av-cell-current')).toBe(true)
  })

  it('highlights the matched gallery block field by data-field-id when no column index is available', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-wysiwyg">
          <div data-node-id="av-block-gallery-real-dom" data-type="NodeAttributeView" class="av" data-av-id="av-gallery-real-dom" data-render="true">
            <div class="av__gallery-item" data-id="item-1">
              <div class="av__gallery-fields">
                <div class="av__gallery-field">
                  <div class="av__gallery-tip">编辑 传感器</div>
                  <div class="av__cell" data-field-id="col-block" data-dtype="block">
                    <span class="av__celltext">传感器</span>
                    <span class="b3-chip b3-chip--small" data-type="block-more">更多</span>
                  </div>
                </div>
                <div class="av__gallery-field">
                  <div class="av__gallery-tip">编辑 文本</div>
                  <div class="av__cell" data-field-id="col-text" data-dtype="text">
                    <span class="av__celltext">次要传感器</span>
                  </div>
                </div>
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
        avBlockId: 'av-block-gallery-real-dom',
        avID: 'av-gallery-real-dom',
        columnName: '',
        itemID: 'item-1',
        keyID: 'col-block',
        rowID: 'item-1',
      },
      blockId: 'av-block-gallery-real-dom',
      blockIndex: 0,
      blockType: 'NodeAttributeView',
      end: 4,
      id: 'av:av-block-gallery-real-dom:item-1:col-block:0:4',
      matchedText: '传感器',
      previewText: '[传感器]',
      replaceable: false,
      rootId: 'root-1',
      sourceKind: 'attribute-view',
      start: 0,
    }

    syncSearchDecorations(context, [match], match)

    const blockCell = protyle.querySelector<HTMLElement>('[data-field-id="col-block"]')
    const textCell = protyle.querySelector<HTMLElement>('[data-field-id="col-text"]')

    expect(blockCell?.classList.contains('sfsr-av-cell-current')).toBe(true)
    expect(textCell?.classList.contains('sfsr-av-cell-current')).toBe(false)
  })

  it('highlights the logical split-pane attribute view cell by global column index', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-wysiwyg">
          <div data-node-id="av-block-split-pane" data-type="NodeAttributeView" class="av" data-av-id="av-split-pane" data-render="true">
            <div class="av__row av__row--header">
              <div class="av__body">
                <div class="av__cell av__cell--header" data-key-id="col-fixed"><div class="av__celltext">固定列</div></div>
                <div class="av__cell av__cell--header" data-key-id="col-main"><div class="av__celltext">主列</div></div>
                <div class="av__cell av__cell--header" data-key-id="col-tail"><div class="av__celltext">尾列</div></div>
              </div>
            </div>
            <div class="av__table-pane av__table-pane--scrollable">
              <div class="av__row" data-id="item-1">
                <div class="av__body">
                  <div class="av__cell" data-key-id="col-main"><div class="av__celltext">传感器-main</div></div>
                  <div class="av__cell" data-key-id="col-tail"><div class="av__celltext">传感器-tail</div></div>
                </div>
              </div>
            </div>
            <div class="av__table-pane av__table-pane--fixed">
              <div class="av__row" data-id="item-1">
                <div class="av__body">
                  <div class="av__cell" data-key-id="col-fixed"><div class="av__celltext">传感器-fixed</div></div>
                </div>
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
        avBlockId: 'av-block-split-pane',
        avID: 'av-split-pane',
        columnName: '主列',
        columnIndex: 1,
        itemID: 'item-1',
        keyID: 'col-main',
        rowID: 'item-1',
      },
      blockId: 'av-block-split-pane',
      blockIndex: 0,
      blockType: 'NodeAttributeView',
      end: 4,
      id: 'av:av-block-split-pane:item-1:col-main:0:4',
      matchedText: '传感器-main',
      previewText: '主列: [传感器-main]',
      replaceable: false,
      rootId: 'root-1',
      sourceKind: 'attribute-view',
      start: 0,
    }

    syncSearchDecorations(context, [match], match)

    const fixedCell = protyle.querySelector<HTMLElement>('.av__table-pane--fixed .av__cell[data-key-id="col-fixed"]')
    const mainCell = protyle.querySelector<HTMLElement>('.av__table-pane--scrollable .av__cell[data-key-id="col-main"]')
    const tailCell = protyle.querySelector<HTMLElement>('.av__table-pane--scrollable .av__cell[data-key-id="col-tail"]')

    expect(fixedCell?.classList.contains('sfsr-av-cell-current')).toBe(false)
    expect(mainCell?.classList.contains('sfsr-av-cell-current')).toBe(true)
    expect(tailCell?.classList.contains('sfsr-av-cell-current')).toBe(false)
  })

  it('highlights only the matched kanban field when repeated text appears in multiple fields', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-wysiwyg">
          <div data-node-id="av-block-kanban" data-type="NodeAttributeView" class="av" data-av-id="av-kanban" data-render="true">
            <div class="av__kanban-item" data-id="item-kanban-1">
              <div class="av__body">
                <div class="av__cell"><div class="av__celltext">重复文本</div></div>
                <div class="av__cell"><div class="av__celltext">重复文本</div></div>
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
        avBlockId: 'av-block-kanban',
        avID: 'av-kanban',
        columnName: '状态',
        columnIndex: 1,
        itemID: 'item-kanban-1',
        keyID: '__dom-col-1__',
        rowID: 'item-kanban-1',
      },
      blockId: 'av-block-kanban',
      blockIndex: 0,
      blockType: 'NodeAttributeView',
      end: 4,
      id: 'av:av-block-kanban:item-kanban-1:__dom-col-1__:0:4',
      matchedText: '重复文本',
      previewText: '状态: [重复文本]',
      replaceable: false,
      rootId: 'root-1',
      sourceKind: 'attribute-view',
      start: 0,
    }

    syncSearchDecorations(context, [match], match)

    const cells = protyle.querySelectorAll<HTMLElement>('.av__kanban-item .av__cell')
    expect(cells[0]?.classList.contains('sfsr-av-cell-current')).toBe(false)
    expect(cells[1]?.classList.contains('sfsr-av-cell-current')).toBe(true)
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

  it('highlights only the matched text in native SiYuan table cells when CSS highlights are available', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-wysiwyg">
          <div data-node-id="table-1" data-type="NodeTable" class="table">
            <div contenteditable="false">
              <table contenteditable="true" spellcheck="false">
                <tbody>
                  <tr>
                    <td>OpenAI / ChatGPT2、Codex</td>
                    <td>ghbdfxg@gmail.com</td>
                    <td>团队帐号</td>
                  </tr>
                  <tr>
                    <td>Codex</td>
                    <td>教程链接</td>
                    <td>API key</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector('.protyle') as HTMLElement
    const targetCell = protyle.querySelectorAll<HTMLElement>('tbody td')[0]
    const context: EditorContext = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    const match: SearchMatch = {
      blockId: 'table-1',
      blockIndex: 0,
      blockType: 'NodeTable',
      end: 23,
      id: 'table-1:18:23',
      matchedText: 'Codex',
      previewText: '...ChatGPT2、[Codex]...',
      replaceable: true,
      rootId: 'root-1',
      start: 18,
      table: {
        cellEnd: 23,
        cellId: '',
        cellStart: 0,
        columnCount: 3,
        columnIndex: 0,
        rowCount: 2,
        rowIndex: 0,
      },
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

    expect(targetCell?.classList.contains('sfsr-av-cell-match')).toBe(false)
    expect(targetCell?.classList.contains('sfsr-av-cell-current')).toBe(false)
    expect(protyle.querySelector('[data-node-id="table-1"]')?.classList.contains('sfsr-block-current')).toBe(false)
    expect(highlights.get('sfsr-match')?.ranges.map(range => range.toString())).toContain('Codex')
    expect(highlights.get('sfsr-current-match')?.ranges.map(range => range.toString())).toContain('Codex')
  })
})
