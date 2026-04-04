import { getBlockElement } from './blocks'
import type {
  EditorContext,
  SearchMatch,
} from '../types'

export function findAttributeViewCellElements(context: EditorContext, match: SearchMatch) {
  if (match.sourceKind !== 'attribute-view' || !match.attributeView) {
    return []
  }

  const blockElement = getBlockElement(context, match.attributeView.avBlockId)
  if (!blockElement) {
    return []
  }

  if (match.attributeView.targetKind === 'view-name') {
    return findAttributeViewTitleElements(blockElement, match)
  }

  if (match.attributeView.targetKind === 'group-title') {
    return findAttributeViewGroupTitleElements(blockElement, match)
  }

  if (match.attributeView.targetKind === 'column-header') {
    return findAttributeViewHeaderCellElements(blockElement, match)
  }

  const rowElements = findAttributeViewRowElements(blockElement, match)
  for (const rowElement of rowElements) {
    const rowCells = getAttributeViewRowCells(rowElement)
    if (!rowCells.length) {
      continue
    }

    const exactCell = selectCellByColumnIndex(rowCells, match)
    if (exactCell) {
      return [exactCell]
    }

    const matchedCells = rowCells.filter(cell => cellContainsMatchedText(cell, match.matchedText))
    if (matchedCells.length) {
      return matchedCells
    }
  }

  const legacyCells = findLegacyAttributeViewCellElements(blockElement, match)
  if (legacyCells.length) {
    return legacyCells
  }

  return Array.from(blockElement.querySelectorAll<HTMLElement>('.av__cell'))
    .filter(cell => !cell.classList.contains('av__cell--header'))
    .filter(cell => cellContainsMatchedText(cell, match.matchedText))
}

function findAttributeViewRowElements(blockElement: HTMLElement, match: SearchMatch) {
  const attributeView = match.attributeView
  if (!attributeView) {
    return []
  }

  const rows: HTMLElement[] = []
  const seen = new Set<HTMLElement>()
  const rowIdentifiers = [attributeView.rowID, attributeView.itemID]
    .filter((value): value is string => Boolean(value?.trim()))

  rowIdentifiers.forEach((rowIdentifier) => {
    const escapedIdentifier = escapeAttributeValue(rowIdentifier)
    blockElement.querySelectorAll<HTMLElement>([
      `.av__row[data-id="${escapedIdentifier}"]`,
      `.av__gallery-item[data-id="${escapedIdentifier}"]`,
      `.av__card[data-id="${escapedIdentifier}"]`,
      `.av__kanban-item[data-id="${escapedIdentifier}"]`,
      `[data-item-id="${escapedIdentifier}"]`,
      `[data-row-id="${escapedIdentifier}"]`,
    ].join(', '))
      .forEach((rowElement) => {
        if (!seen.has(rowElement)) {
          seen.add(rowElement)
          rows.push(rowElement)
        }
      })
  })

  return rows
}

function getAttributeViewRowCells(rowElement: HTMLElement) {
  const body = rowElement.querySelector<HTMLElement>(':scope > .av__body')
    ?? rowElement.querySelector<HTMLElement>('.av__body')
    ?? rowElement

  const directCells = Array.from(body.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement)
    .filter(child => child.classList.contains('av__cell'))
    .filter(child => !child.classList.contains('av__cell--header'))
  if (directCells.length > 0) {
    return directCells
  }

  const descendantCells = Array.from(body.querySelectorAll<HTMLElement>('.av__cell'))
    .filter(child => !child.classList.contains('av__cell--header'))
  if (descendantCells.length > 0) {
    return getTopLevelElements(descendantCells)
  }

  const keyedCells = Array.from(body.querySelectorAll<HTMLElement>('[data-av-key-id], [data-key-id]'))
    .filter(child => !child.classList.contains('av__cell--header'))
  if (keyedCells.length > 0) {
    return getTopLevelElements(keyedCells)
  }

  return []
}

function selectCellByColumnIndex(rowCells: HTMLElement[], match: SearchMatch) {
  const columnIndex = match.attributeView?.columnIndex
  if (typeof columnIndex !== 'number' || columnIndex < 0 || columnIndex >= rowCells.length) {
    return null
  }

  return rowCells[columnIndex] ?? null
}

function cellContainsMatchedText(cell: HTMLElement, matchedText: string) {
  const normalizedMatchedText = normalizeText(matchedText)
  if (!normalizedMatchedText) {
    return false
  }

  return normalizeText(getCellTextContent(cell)).includes(normalizedMatchedText)
}

function getCellTextContent(cell: HTMLElement) {
  const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!(node instanceof Text) || !node.nodeValue?.trim()) {
        return NodeFilter.FILTER_REJECT
      }

      const parentElement = node.parentElement
      if (!parentElement || parentElement.closest('.protyle-attr, .fn__none, svg, style, script')) {
        return NodeFilter.FILTER_REJECT
      }

      return NodeFilter.FILTER_ACCEPT
    },
  })

  const parts: string[] = []
  let currentNode = walker.nextNode()
  while (currentNode) {
    parts.push((currentNode as Text).nodeValue ?? '')
    currentNode = walker.nextNode()
  }

  return parts.join('')
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function findLegacyAttributeViewCellElements(blockElement: HTMLElement, match: SearchMatch) {
  for (const selector of buildLegacyAttributeViewCellSelectors(match)) {
    const cells = Array.from(blockElement.querySelectorAll<HTMLElement>(selector))
    if (cells.length > 0) {
      return cells
    }
  }

  return []
}

function findAttributeViewHeaderCellElements(blockElement: HTMLElement, match: SearchMatch) {
  const headerCells = Array.from(blockElement.querySelectorAll<HTMLElement>('.av__row--header .av__cell.av__cell--header'))
  const normalizedHeaderCells = headerCells.length
    ? headerCells
    : Array.from(blockElement.querySelectorAll<HTMLElement>('.av__cell.av__cell--header'))

  const exactCell = selectCellByColumnIndex(normalizedHeaderCells, match)
  if (exactCell) {
    return [exactCell]
  }

  return normalizedHeaderCells.filter(cell => cellContainsMatchedText(cell, match.matchedText))
}

function findAttributeViewTitleElements(blockElement: HTMLElement, match: SearchMatch) {
  const candidates = Array.from(blockElement.querySelectorAll<HTMLElement>(
    '.av__title, .av__title-text, .av__header-title, .av__name',
  ))
  const matchedCandidates = candidates.filter(candidate => cellContainsMatchedText(candidate, match.matchedText))
  if (matchedCandidates.length) {
    return matchedCandidates
  }

  return [blockElement]
}

function findAttributeViewGroupTitleElements(blockElement: HTMLElement, match: SearchMatch) {
  const candidates = Array.from(blockElement.querySelectorAll<HTMLElement>(
    '.av__group-title, .av__group-name, .av__group-label',
  ))

  return candidates.filter(candidate => cellContainsMatchedText(candidate, match.matchedText))
}

function buildLegacyAttributeViewCellSelectors(match: SearchMatch) {
  const attributeView = match.attributeView
  if (!attributeView) {
    return []
  }

  const rowIdentifiers = [attributeView.itemID, attributeView.rowID]
    .filter((value): value is string => Boolean(value?.trim()))
  const keyId = escapeAttributeValue(attributeView.keyID)
  const selectors: string[] = []

  rowIdentifiers.forEach((rowIdentifier) => {
    const row = escapeAttributeValue(rowIdentifier)
    selectors.push(
      `[data-av-item-id="${row}"][data-av-key-id="${keyId}"]`,
      `[data-item-id="${row}"][data-key-id="${keyId}"]`,
      `[data-row-id="${row}"][data-key-id="${keyId}"]`,
      `[data-id="${row}"][data-key-id="${keyId}"]`,
      `[data-av-item-id="${row}"] [data-av-key-id="${keyId}"]`,
      `[data-item-id="${row}"] [data-key-id="${keyId}"]`,
      `[data-row-id="${row}"] [data-key-id="${keyId}"]`,
      `[data-id="${row}"] [data-key-id="${keyId}"]`,
    )
  })

  if (selectors.length === 0) {
    selectors.push(`[data-av-key-id="${keyId}"]`, `[data-key-id="${keyId}"]`)
  }

  return selectors
}

function escapeAttributeValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function getTopLevelElements(elements: HTMLElement[]) {
  return elements.filter((element, index) => (
    elements.findIndex(candidate => candidate === element) === index
      && !elements.some(candidate => candidate !== element && candidate.contains(element))
  ))
}
