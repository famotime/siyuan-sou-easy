const TABLE_CELL_SELECTOR = '[data-type="NodeTableCell"], .table__cell, td, th'

export function getTableRowCells(row: HTMLElement) {
  return Array.from(row.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement)
    .filter(child => child.matches(TABLE_CELL_SELECTOR))
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
