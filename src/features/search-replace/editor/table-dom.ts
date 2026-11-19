import type { SearchMatch } from '../types'

const TABLE_CELL_SELECTOR = '[data-type="NodeTableCell"], .table__cell, td, th'

export function getTableRowCells(row: HTMLElement) {
  return Array.from(row.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement)
    .filter((child) => child.matches(TABLE_CELL_SELECTOR))
}

export function getTableRowElements(tableBlock: HTMLElement) {
  const explicitRows = Array.from(tableBlock.querySelectorAll<HTMLElement>('.table__row'))
  if (explicitRows.length) {
    return explicitRows
  }

  const nativeRows = Array.from(tableBlock.querySelectorAll<HTMLElement>('tr'))
  if (nativeRows.length) {
    return nativeRows
  }

  const cells = Array.from(tableBlock.querySelectorAll<HTMLElement>(TABLE_CELL_SELECTOR))
  const rows: HTMLElement[] = []
  const seen = new Set<HTMLElement>()

  cells.forEach((cell) => {
    const row = resolveTableRowElementFromCell(cell, tableBlock)
    if (!row || seen.has(row)) {
      return
    }

    seen.add(row)
    rows.push(row)
  })

  return rows
}

/**
 * 依据匹配元数据在表格块内定位单元格，查找顺序：
 * 1. cellId 精确匹配；
 * 2. 行列索引定位；
 * 3. 包含 matchedText 的单元格回退（应对合并单元格等行结构不一致场景）。
 */
export function findTableCellElementByMetadata(tableBlock: HTMLElement, match: SearchMatch) {
  const cellId = match.table?.cellId?.trim()
  if (cellId) {
    const exactCell = tableBlock.querySelector<HTMLElement>(`[data-node-id="${cellId}"][data-type="NodeTableCell"]`)
      ?? tableBlock.querySelector<HTMLElement>(`[data-node-id="${cellId}"].table__cell`)
    if (exactCell) {
      return exactCell
    }
  }

  const rowIndex = match.table?.rowIndex
  const columnIndex = match.table?.columnIndex
  if (typeof rowIndex === 'number' && typeof columnIndex === 'number') {
    const rows = getTableRowElements(tableBlock)
    const targetRow = rows[rowIndex]
    if (targetRow) {
      const rowCells = getTableRowCells(targetRow)

      if (rowCells[columnIndex]) {
        return rowCells[columnIndex]
      }
    }
  }

  // 增强回退：如果由于合并单元格或行结构不一致未能按索引定位，则在表格中寻找包含 matchedText 的单元格
  if (match.matchedText) {
    const allCells = Array.from(tableBlock.querySelectorAll<HTMLElement>(TABLE_CELL_SELECTOR))
    const needle = match.matchedText.toLowerCase()
    const matchingCell = allCells.find((cell) => cell.textContent?.toLowerCase().includes(needle))
    if (matchingCell) {
      return matchingCell
    }
  }

  return null
}

export function resolveTableRowElementFromCell(cell: HTMLElement, tableBlock: HTMLElement) {
  let current = cell.parentElement
  while (current && current !== tableBlock) {
    const rowCells = getTableRowCells(current)
    if (rowCells.length > 0 && rowCells.includes(cell)) {
      return current
    }
    current = current.parentElement
  }

  return cell.parentElement && tableBlock.contains(cell.parentElement)
    ? cell.parentElement
    : null
}
