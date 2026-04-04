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

const originalRangeGetBoundingClientRect = Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect')
const originalRangeGetClientRects = Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects')

describe('match scrolling', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    restoreRangeMethods()
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

  it('scrolls when a long paragraph block is visible but the matched text range is below the viewport', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="block-1" data-type="NodeParagraph">
              <div contenteditable="true">Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa</div>
            </div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const container = document.querySelector<HTMLElement>('.protyle-content')!
    const block = document.querySelector<HTMLElement>('[data-node-id="block-1"]')!
    const blockScrollSpy = vi.fn()
    const containerScrollSpy = vi.fn()
    block.scrollIntoView = blockScrollSpy
    container.scrollTo = containerScrollSpy as any

    Object.defineProperty(container, 'clientHeight', {
      configurable: true,
      value: 300,
    })
    Object.defineProperty(container, 'scrollHeight', {
      configurable: true,
      value: 1200,
    })
    Object.defineProperty(container, 'scrollTop', {
      configurable: true,
      get: () => 0,
      set: () => {},
    })

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
    vi.spyOn(block, 'getBoundingClientRect').mockReturnValue({
      bottom: 380,
      height: 240,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 140,
      width: 320,
      x: 0,
      y: 140,
    })
    mockRangeRects({
      bottom: 500,
      height: 24,
      left: 0,
      right: 120,
      top: 476,
      width: 120,
      x: 0,
      y: 476,
    })

    const result = scrollMatchIntoView(protyleContext(protyle), {
      blockId: 'block-1',
      blockIndex: 0,
      blockType: 'NodeParagraph',
      end: 16,
      id: 'block-1:11:16',
      matchedText: 'Gamma',
      previewText: 'Alpha Beta [Gamma] Delta',
      replaceable: true,
      rootId: 'root-1',
      start: 11,
    }, 'if-needed')

    expect(result).toBe('scrolled')
    expect(containerScrollSpy).toHaveBeenCalled()
    expect(blockScrollSpy).not.toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
      inline: 'center',
    })
  })

  it('scrolls when a long code block is visible but the matched text range is below the viewport', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="code-1" data-type="NodeCodeBlock">
              <div contenteditable="true">const alpha = 1;\nconst beta = 2;\nconst gamma = 3;\nconst delta = 4;</div>
            </div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const container = document.querySelector<HTMLElement>('.protyle-content')!
    const block = document.querySelector<HTMLElement>('[data-node-id="code-1"]')!
    const containerScrollSpy = vi.fn()
    block.scrollIntoView = vi.fn()
    container.scrollTo = containerScrollSpy as any

    Object.defineProperty(container, 'clientHeight', {
      configurable: true,
      value: 300,
    })
    Object.defineProperty(container, 'scrollHeight', {
      configurable: true,
      value: 1600,
    })
    Object.defineProperty(container, 'scrollTop', {
      configurable: true,
      get: () => 120,
      set: () => {},
    })

    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      bottom: 460,
      height: 300,
      left: 0,
      right: 480,
      toJSON: () => ({}),
      top: 160,
      width: 480,
      x: 0,
      y: 160,
    })
    vi.spyOn(block, 'getBoundingClientRect').mockReturnValue({
      bottom: 430,
      height: 220,
      left: 0,
      right: 480,
      toJSON: () => ({}),
      top: 210,
      width: 480,
      x: 0,
      y: 210,
    })
    mockRangeRects({
      bottom: 540,
      height: 20,
      left: 0,
      right: 180,
      top: 520,
      width: 180,
      x: 0,
      y: 520,
    })

    const result = scrollMatchIntoView(protyleContext(protyle), {
      blockId: 'code-1',
      blockIndex: 0,
      blockType: 'NodeCodeBlock',
      end: 50,
      id: 'code-1:45:50',
      matchedText: 'gamma',
      previewText: 'const beta = 2; const [gamma] = 3;',
      replaceable: true,
      rootId: 'root-1',
      start: 45,
    }, 'if-needed')

    expect(result).toBe('scrolled')
    expect(containerScrollSpy).toHaveBeenCalled()
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

  it('scrolls and centers the matched table cell when it is horizontally outside the visible range', () => {
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
    const targetRow = document.querySelector<HTMLElement>('.table__row')!
    const targetCell = document.querySelector<HTMLElement>('[data-node-id="cell-2"]')!
    const rowScrollSpy = vi.fn()
    const cellScrollSpy = vi.fn()
    targetRow.scrollIntoView = rowScrollSpy
    targetCell.scrollIntoView = cellScrollSpy

    const container = document.querySelector<HTMLElement>('.protyle-content')!
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
    vi.spyOn(targetCell, 'getBoundingClientRect').mockReturnValue({
      bottom: 260,
      height: 40,
      left: 540,
      right: 860,
      toJSON: () => ({}),
      top: 220,
      width: 320,
      x: 540,
      y: 220,
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
    expect(rowScrollSpy).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    })
    expect(cellScrollSpy).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  })

  it('scrolls the matched table cell when it is vertically clipped by a nested table scroll container', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div class="table-scroll" style="overflow: auto; max-height: 240px; max-width: 320px;">
              <div data-node-id="table-1" data-type="NodeTable" class="table">
                <div class="table__row">
                  <div data-node-id="cell-1" data-type="NodeTableCell" class="table__cell">
                    <div contenteditable="true">Cell Alpha</div>
                  </div>
                </div>
                <div class="table__row">
                  <div data-node-id="cell-2" data-type="NodeTableCell" class="table__cell">
                    <div contenteditable="true">Cell Beta</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const container = document.querySelector<HTMLElement>('.protyle-content')!
    const tableScrollContainer = document.querySelector<HTMLElement>('.table-scroll')!
    const targetRow = document.querySelectorAll<HTMLElement>('.table__row')[1]!
    const targetCell = document.querySelector<HTMLElement>('[data-node-id="cell-2"]')!
    const rowScrollSpy = vi.fn()
    const cellScrollSpy = vi.fn()
    targetRow.scrollIntoView = rowScrollSpy
    targetCell.scrollIntoView = cellScrollSpy

    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      bottom: 700,
      height: 600,
      left: 0,
      right: 900,
      toJSON: () => ({}),
      top: 100,
      width: 900,
      x: 0,
      y: 100,
    })
    vi.spyOn(tableScrollContainer, 'getBoundingClientRect').mockReturnValue({
      bottom: 360,
      height: 240,
      left: 40,
      right: 360,
      toJSON: () => ({}),
      top: 120,
      width: 320,
      x: 40,
      y: 120,
    })
    vi.spyOn(targetCell, 'getBoundingClientRect').mockReturnValue({
      bottom: 500,
      height: 40,
      left: 40,
      right: 360,
      toJSON: () => ({}),
      top: 460,
      width: 320,
      x: 40,
      y: 460,
    })

    const result = scrollMatchIntoView(protyleContext(protyle), {
      blockId: 'table-1',
      blockIndex: 1,
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
    expect(rowScrollSpy).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    })
    expect(cellScrollSpy).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  })

  it('uses table metadata to center the matched row instead of the whole table when live offsets are stale', () => {
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
              </div>
              <div class="table__row">
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
    const targetRow = document.querySelectorAll<HTMLElement>('.table__row')[1]!
    const targetCell = document.querySelector<HTMLElement>('[data-node-id="cell-2"]')!
    const tableScrollSpy = vi.fn()
    const rowScrollSpy = vi.fn()
    const cellScrollSpy = vi.fn()
    tableBlock.scrollIntoView = tableScrollSpy
    targetRow.scrollIntoView = rowScrollSpy
    targetCell.scrollIntoView = cellScrollSpy
    const containerScrollSpy = vi.fn()

    Object.defineProperty(container, 'clientHeight', {
      configurable: true,
      value: 260,
    })
    Object.defineProperty(container, 'scrollHeight', {
      configurable: true,
      value: 5000,
    })
    Object.defineProperty(container, 'scrollTop', {
      configurable: true,
      get: () => 0,
      set: () => {},
    })
    container.scrollTo = containerScrollSpy as any

    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      bottom: 360,
      height: 260,
      left: 0,
      right: 420,
      toJSON: () => ({}),
      top: 100,
      width: 420,
      x: 0,
      y: 100,
    })
    vi.spyOn(targetRow, 'getBoundingClientRect').mockReturnValue({
      bottom: 520,
      height: 48,
      left: 0,
      right: 420,
      toJSON: () => ({}),
      top: 472,
      width: 420,
      x: 0,
      y: 472,
    })
    vi.spyOn(targetCell, 'getBoundingClientRect').mockReturnValue({
      bottom: 520,
      height: 48,
      left: 220,
      right: 420,
      toJSON: () => ({}),
      top: 472,
      width: 200,
      x: 220,
      y: 472,
    })

    const result = scrollMatchIntoView(protyleContext(protyle), {
      blockId: 'table-1',
      blockIndex: 0,
      blockType: 'NodeTable',
      end: 104,
      id: 'table-1:100:104',
      matchedText: 'Beta',
      previewText: 'Cell AlphaCell [Beta]',
      replaceable: true,
      rootId: 'root-1',
      start: 100,
      table: {
        cellEnd: 19,
        cellId: 'cell-2',
        cellStart: 10,
        columnCount: 1,
        columnIndex: 0,
        rowCount: 2,
        rowIndex: 1,
      },
    } as SearchMatch, 'if-needed')

    expect(result).toBe('scrolled')
    expect(rowScrollSpy).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    })
    expect(cellScrollSpy).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
    expect(tableScrollSpy).not.toHaveBeenCalled()
  })

  it('centers the matched row even when the row container has no table__row class', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="table-1" data-type="NodeTable" class="table">
              <div class="custom-row">
                <div data-node-id="cell-1" data-type="NodeTableCell" class="table__cell">
                  <div contenteditable="true">Cell Alpha</div>
                </div>
              </div>
              <div class="custom-row">
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
    const targetRow = document.querySelectorAll<HTMLElement>('.custom-row')[1]!
    const targetCell = document.querySelector<HTMLElement>('[data-node-id="cell-2"]')!
    const tableScrollSpy = vi.fn()
    const rowScrollSpy = vi.fn()
    const cellScrollSpy = vi.fn()
    tableBlock.scrollIntoView = tableScrollSpy
    targetRow.scrollIntoView = rowScrollSpy
    targetCell.scrollIntoView = cellScrollSpy

    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      bottom: 360,
      height: 260,
      left: 0,
      right: 420,
      toJSON: () => ({}),
      top: 100,
      width: 420,
      x: 0,
      y: 100,
    })
    vi.spyOn(targetRow, 'getBoundingClientRect').mockReturnValue({
      bottom: 520,
      height: 48,
      left: 0,
      right: 420,
      toJSON: () => ({}),
      top: 472,
      width: 420,
      x: 0,
      y: 472,
    })
    vi.spyOn(targetCell, 'getBoundingClientRect').mockReturnValue({
      bottom: 520,
      height: 48,
      left: 220,
      right: 420,
      toJSON: () => ({}),
      top: 472,
      width: 200,
      x: 220,
      y: 472,
    })

    const result = scrollMatchIntoView(protyleContext(protyle), {
      blockId: 'table-1',
      blockIndex: 0,
      blockType: 'NodeTable',
      end: 104,
      id: 'table-1:100:104',
      matchedText: 'Beta',
      previewText: 'Cell AlphaCell [Beta]',
      replaceable: true,
      rootId: 'root-1',
      start: 100,
      table: {
        cellEnd: 19,
        cellId: 'cell-2',
        cellStart: 10,
        columnCount: 1,
        columnIndex: 0,
        rowCount: 2,
        rowIndex: 1,
      },
    } as SearchMatch, 'if-needed')

    expect(result).toBe('scrolled')
    expect(rowScrollSpy).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    })
    expect(cellScrollSpy).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
    expect(tableScrollSpy).not.toHaveBeenCalled()
  })

  it('centers the matched native table row and cell in the actual SiYuan table DOM structure', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="table-1" data-type="NodeTable" class="table">
              <div contenteditable="false">
                <table contenteditable="true" spellcheck="false">
                  <thead>
                    <tr>
                      <th>服务</th>
                      <th>用户名</th>
                      <th>密码</th>
                    </tr>
                  </thead>
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
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const container = document.querySelector<HTMLElement>('.protyle-content')!
    const tableBlock = document.querySelector<HTMLElement>('[data-node-id="table-1"]')!
    const targetRow = document.querySelectorAll<HTMLTableRowElement>('tbody tr')[1]!
    const targetCell = targetRow.querySelector<HTMLTableCellElement>('td')!
    const tableScrollSpy = vi.fn()
    const rowScrollSpy = vi.fn()
    const cellScrollSpy = vi.fn()
    const containerScrollSpy = vi.fn()
    tableBlock.scrollIntoView = tableScrollSpy
    targetRow.scrollIntoView = rowScrollSpy
    targetCell.scrollIntoView = cellScrollSpy
    Object.defineProperty(container, 'clientHeight', {
      configurable: true,
      value: 260,
    })
    Object.defineProperty(container, 'scrollHeight', {
      configurable: true,
      value: 5000,
    })
    Object.defineProperty(container, 'scrollTop', {
      configurable: true,
      get: () => 0,
      set: () => {},
    })
    container.scrollTo = containerScrollSpy as any

    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      bottom: 360,
      height: 260,
      left: 0,
      right: 420,
      toJSON: () => ({}),
      top: 100,
      width: 420,
      x: 0,
      y: 100,
    })
    vi.spyOn(targetRow, 'getBoundingClientRect').mockReturnValue({
      bottom: 520,
      height: 48,
      left: 0,
      right: 420,
      toJSON: () => ({}),
      top: 472,
      width: 420,
      x: 0,
      y: 472,
    })
    vi.spyOn(targetCell, 'getBoundingClientRect').mockReturnValue({
      bottom: 520,
      height: 48,
      left: 0,
      right: 180,
      toJSON: () => ({}),
      top: 472,
      width: 180,
      x: 0,
      y: 472,
    })

    const result = scrollMatchIntoView(protyleContext(protyle), {
      blockId: 'table-1',
      blockIndex: 0,
      blockType: 'NodeTable',
      end: 500,
      id: 'table-1:495:500',
      matchedText: 'Codex',
      previewText: '...[Codex]...',
      replaceable: true,
      rootId: 'root-1',
      start: 495,
      table: {
        cellEnd: 63,
        cellId: '',
        cellStart: 58,
        columnCount: 3,
        columnIndex: 0,
        rowCount: 3,
        rowIndex: 2,
      },
    } as SearchMatch, 'if-needed')

    expect(result).toBe('scrolled')
    expect(rowScrollSpy).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    })
    expect(cellScrollSpy).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
    expect(containerScrollSpy).toHaveBeenCalled()
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

function mockRangeRects(rect: DOMRectInit) {
  const normalizedRect = {
    bottom: rect.bottom ?? ((rect.y ?? rect.top ?? 0) + (rect.height ?? 0)),
    height: rect.height ?? 0,
    left: rect.left ?? rect.x ?? 0,
    right: rect.right ?? ((rect.x ?? rect.left ?? 0) + (rect.width ?? 0)),
    toJSON: () => ({}),
    top: rect.top ?? rect.y ?? 0,
    width: rect.width ?? 0,
    x: rect.x ?? rect.left ?? 0,
    y: rect.y ?? rect.top ?? 0,
  }

  if (!Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect')) {
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      configurable: true,
      value() {
        return normalizedRect
      },
      writable: true,
    })
  }
  if (!Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects')) {
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value() {
        return [normalizedRect]
      },
      writable: true,
    })
  }

  vi.spyOn(Range.prototype, 'getBoundingClientRect').mockReturnValue(normalizedRect as DOMRect)
  vi.spyOn(Range.prototype, 'getClientRects').mockReturnValue([
    normalizedRect as DOMRect,
  ] as unknown as DOMRectList)
}

function restoreRangeMethods() {
  if (originalRangeGetBoundingClientRect) {
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', originalRangeGetBoundingClientRect)
  } else {
    delete (Range.prototype as Partial<Range>).getBoundingClientRect
  }

  if (originalRangeGetClientRects) {
    Object.defineProperty(Range.prototype, 'getClientRects', originalRangeGetClientRects)
  } else {
    delete (Range.prototype as Partial<Range>).getClientRects
  }
}
