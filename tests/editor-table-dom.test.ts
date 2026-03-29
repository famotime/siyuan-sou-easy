// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  getTableRowCells,
  getTableRowElements,
  resolveTableRowElementFromCell,
} from '@/features/search-replace/editor/table-dom'

describe('editor table DOM helpers', () => {
  it('collects custom table rows from NodeTableCell containers', () => {
    document.body.innerHTML = `
      <div data-node-id="table-1" data-type="NodeTable" class="table">
        <div class="custom-row">
          <div data-node-id="cell-1" data-type="NodeTableCell" class="table__cell"></div>
        </div>
        <div class="custom-row">
          <div data-node-id="cell-2" data-type="NodeTableCell" class="table__cell"></div>
        </div>
      </div>
    `

    const tableBlock = document.querySelector<HTMLElement>('[data-node-id="table-1"]')!
    const targetCell = document.querySelector<HTMLElement>('[data-node-id="cell-2"]')!

    const rows = getTableRowElements(tableBlock)

    expect(rows).toHaveLength(2)
    expect(resolveTableRowElementFromCell(targetCell, tableBlock)).toBe(rows[1])
    expect(getTableRowCells(rows[1]!)).toEqual([targetCell])
  })

  it('prefers native table rows and cells when they exist', () => {
    document.body.innerHTML = `
      <div data-node-id="table-2" data-type="NodeTable" class="table">
        <table>
          <tbody>
            <tr>
              <td>Alpha</td>
              <td>Beta</td>
            </tr>
          </tbody>
        </table>
      </div>
    `

    const tableBlock = document.querySelector<HTMLElement>('[data-node-id="table-2"]')!
    const row = tableBlock.querySelector<HTMLElement>('tr')!
    const cell = row.querySelector<HTMLElement>('td:last-child')!

    expect(getTableRowElements(tableBlock)).toEqual([row])
    expect(getTableRowCells(row)).toHaveLength(2)
    expect(resolveTableRowElementFromCell(cell, tableBlock)).toBe(row)
  })
})
