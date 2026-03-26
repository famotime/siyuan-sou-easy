// @vitest-environment jsdom

import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest'

import {
  applyReplacementsToClone,
  collectSearchableBlocks,
  createEditorContextFromElement,
  getBlockPlainText,
} from '@/features/search-replace/editor'
import { findMatches } from '@/features/search-replace/search-engine'
import type { SearchOptions } from '@/features/search-replace/types'

const defaultOptions: SearchOptions = {
  includeCodeBlock: false,
  matchCase: false,
  searchAttributeView: false,
  selectionOnly: false,
  useRegex: false,
  wholeWord: false,
}

describe('editor block collection', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('collects supported searchable blocks and strips attribute text', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-wysiwyg">
          <div data-node-id="block-1" data-type="NodeParagraph">
            <div contenteditable="true">Alpha <span>Beta</span></div>
            <div class="protyle-attr">
              <div contenteditable="true">Hidden attr</div>
            </div>
          </div>
          <div data-node-id="block-2" data-type="NodeCodeBlock">
            <div contenteditable="true">const count = 1</div>
          </div>
          <div data-node-id="block-3" data-type="NodeTable">
            <div contenteditable="true">Skip this block</div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const context = createEditorContextFromElement(protyle)!
    const paragraphBlock = document.querySelector<HTMLElement>('[data-node-id="block-1"]')!

    expect(getBlockPlainText(paragraphBlock)).toBe('Alpha Beta')

    const withoutCodeBlocks = collectSearchableBlocks(context, defaultOptions)
    const withCodeBlocks = collectSearchableBlocks(context, {
      ...defaultOptions,
      includeCodeBlock: true,
    })

    expect(withoutCodeBlocks.map(block => ({
      blockId: block.blockId,
      text: block.text,
    }))).toEqual([
      {
        blockId: 'block-1',
        text: 'Alpha Beta',
      },
      {
        blockId: 'block-3',
        text: 'Skip this block',
      },
    ])
    expect(withCodeBlocks.map(block => block.blockId)).toEqual(['block-1', 'block-2', 'block-3'])
  })

  it('collects text from table cells so table content can be searched and replaced', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-wysiwyg">
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
    const context = createEditorContextFromElement(protyle)!
    const tableBlock = document.querySelector<HTMLElement>('[data-node-id="block-table"]')!

    expect(getBlockPlainText(tableBlock)).toBe('Cell AlphaCell Beta')

    const blocks = collectSearchableBlocks(context, defaultOptions)
    const matches = findMatches(blocks, 'Alpha', defaultOptions).matches

    expect(blocks.map(block => ({
      blockId: block.blockId,
      blockType: block.blockType,
      text: block.text,
    }))).toEqual([
      {
        blockId: 'block-table',
        blockType: 'NodeTable',
        text: 'Cell AlphaCell Beta',
      },
    ])

    const outcome = applyReplacementsToClone(tableBlock, [matches[0]!], 'Omega')

    expect(matches).toHaveLength(1)
    expect(matches[0]?.replaceable).toBe(true)
    expect(outcome.appliedCount).toBe(1)
    expect(getBlockPlainText(outcome.clone as HTMLElement)).toBe('Cell OmegaCell Beta')
  })

  it('records table cell metadata so later navigation can target the matched row directly', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-wysiwyg">
          <div data-node-id="block-table" data-type="NodeTable">
            <div class="table__row">
              <div data-node-id="cell-1" data-type="NodeTableCell" class="table__cell">
                <div contenteditable="true">Row 1</div>
              </div>
              <div data-node-id="cell-2" data-type="NodeTableCell" class="table__cell">
                <div contenteditable="true">Cell Alpha</div>
              </div>
            </div>
            <div class="table__row">
              <div data-node-id="cell-3" data-type="NodeTableCell" class="table__cell">
                <div contenteditable="true">Row 2</div>
              </div>
              <div data-node-id="cell-4" data-type="NodeTableCell" class="table__cell">
                <div contenteditable="true">Cell Beta</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const context = createEditorContextFromElement(protyle)!
    const blocks = collectSearchableBlocks(context, defaultOptions) as Array<any>

    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.table?.rowCount).toBe(2)
    expect(blocks[0]?.table?.columnCount).toBe(2)
    expect(blocks[0]?.table?.cells).toEqual([
      {
        cellId: 'cell-1',
        columnIndex: 0,
        end: 5,
        rowIndex: 0,
        start: 0,
      },
      {
        cellId: 'cell-2',
        columnIndex: 1,
        end: 15,
        rowIndex: 0,
        start: 5,
      },
      {
        cellId: 'cell-3',
        columnIndex: 0,
        end: 20,
        rowIndex: 1,
        start: 15,
      },
      {
        cellId: 'cell-4',
        columnIndex: 1,
        end: 29,
        rowIndex: 1,
        start: 20,
      },
    ])
  })

  it('records table rows even when the row container has no table__row class', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-wysiwyg">
          <div data-node-id="block-table" data-type="NodeTable">
            <div class="custom-row">
              <div data-node-id="cell-1" data-type="NodeTableCell" class="table__cell">
                <div contenteditable="true">Row 1</div>
              </div>
            </div>
            <div class="custom-row">
              <div data-node-id="cell-2" data-type="NodeTableCell" class="table__cell">
                <div contenteditable="true">Row 2</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const context = createEditorContextFromElement(protyle)!
    const blocks = collectSearchableBlocks(context, defaultOptions) as Array<any>

    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.table?.rowCount).toBe(2)
    expect(blocks[0]?.table?.cells.map((cell: any) => cell.rowIndex)).toEqual([0, 1])
  })

  it('records native table rows and cells from the actual SiYuan table DOM structure', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-wysiwyg">
          <div data-node-id="block-table" data-type="NodeTable" class="table">
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
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const context = createEditorContextFromElement(protyle)!
    const blocks = collectSearchableBlocks(context, defaultOptions) as Array<any>

    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.text).toContain('OpenAI / ChatGPT2、Codex')
    expect(blocks[0]?.text).toContain('Codex')
    expect(blocks[0]?.table?.rowCount).toBe(3)
    expect(blocks[0]?.table?.columnCount).toBe(3)
    expect(blocks[0]?.table?.cells[3]).toMatchObject({
      columnIndex: 0,
      rowIndex: 1,
    })
    expect(blocks[0]?.table?.cells[6]).toMatchObject({
      columnIndex: 0,
      rowIndex: 2,
    })
  })
})
