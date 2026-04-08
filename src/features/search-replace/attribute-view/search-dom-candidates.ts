import type {
  AttributeViewBlockSummary,
  AttributeViewCellCandidate,
} from './search-types'

export function extractDomAttributeViewSearchCandidates({
  attributeViewBlock,
  avID,
}: {
  attributeViewBlock: AttributeViewBlockSummary
  avID: string
}) {
  const blockElement = attributeViewBlock.element
  if (!blockElement.isConnected) {
    return []
  }

  const titleCandidates = collectDomAttributeViewTitleCandidates({
    attributeViewBlock,
    avID,
    blockElement,
  })
  const headerCandidates = collectDomAttributeViewHeaderCandidates({
    attributeViewBlock,
    avID,
    blockElement,
  })
  const groupTitleCandidates = collectDomAttributeViewGroupTitleCandidates({
    attributeViewBlock,
    avID,
    blockElement,
  })
  const headerNames = headerCandidates.map(({ candidate }) => candidate.columnName)
  const rowCandidates = collectDomAttributeViewRowCandidates({
    attributeViewBlock,
    avID,
    blockElement,
    headerNames,
  })

  return [
    ...titleCandidates,
    ...headerCandidates,
    ...groupTitleCandidates,
    ...rowCandidates,
  ]
    .sort((left, right) => compareDomCandidateOrder(left.sourceElement, right.sourceElement))
    .map(({ candidate }) => candidate)
}

function collectDomAttributeViewTitleCandidates({
  attributeViewBlock,
  avID,
  blockElement,
}: {
  attributeViewBlock: AttributeViewBlockSummary
  avID: string
  blockElement: HTMLElement
}) {
  const seen = new Set<string>()
  return Array.from(blockElement.querySelectorAll<HTMLElement>(
    '.av__title, .av__title-text, .av__header-title, .av__name',
  )).flatMap((element, index) => {
    const text = getAttributeViewDomText(element)
    if (!text || seen.has(text)) {
      return []
    }

    seen.add(text)
    return [createOrderedCandidate(element, {
      avBlockId: attributeViewBlock.avBlockId,
      avID,
      columnName: text,
      keyID: `__dom-view-name-${index}__`,
      text,
      targetKind: 'view-name' as const,
    })]
  })
}

function collectDomAttributeViewHeaderCandidates({
  attributeViewBlock,
  avID,
  blockElement,
}: {
  attributeViewBlock: AttributeViewBlockSummary
  avID: string
  blockElement: HTMLElement
}) {
  const headerCells = resolveDomAttributeViewHeaderCells(blockElement)
  return headerCells.flatMap((cell, columnIndex) => {
    const text = getAttributeViewDomText(cell)
    if (!text) {
      return []
    }

    return [createOrderedCandidate(cell, {
      avBlockId: attributeViewBlock.avBlockId,
      avID,
      columnName: text,
      columnIndex,
      keyID: resolveDomAttributeViewKeyId(cell, columnIndex),
      text,
      targetKind: 'column-header' as const,
    })]
  })
}

function collectDomAttributeViewGroupTitleCandidates({
  attributeViewBlock,
  avID,
  blockElement,
}: {
  attributeViewBlock: AttributeViewBlockSummary
  avID: string
  blockElement: HTMLElement
}) {
  const seen = new Set<string>()
  return Array.from(blockElement.querySelectorAll<HTMLElement>(
    '.av__group-title, .av__group-name, .av__group-label',
  )).flatMap((element, index) => {
    const text = getAttributeViewDomText(element)
    if (!text || seen.has(text)) {
      return []
    }

    seen.add(text)
    return [createOrderedCandidate(element, {
      avBlockId: attributeViewBlock.avBlockId,
      avID,
      columnName: text,
      keyID: `__dom-group-title-${index}__`,
      text,
      targetKind: 'group-title' as const,
    })]
  })
}

function collectDomAttributeViewRowCandidates({
  attributeViewBlock,
  avID,
  blockElement,
  headerNames,
}: {
  attributeViewBlock: AttributeViewBlockSummary
  avID: string
  blockElement: HTMLElement
  headerNames: string[]
}) {
  return resolveDomAttributeViewRows(blockElement).flatMap((rowElement) => {
    const rowID = resolveDomAttributeViewRowId(rowElement)
    const rowCells = getDomAttributeViewRowCells(rowElement)
    const rowLabel = rowCells
      .map(cell => getAttributeViewDomText(cell))
      .find(Boolean)

    return rowCells.flatMap((cell, columnIndex) => {
      const text = getAttributeViewDomText(cell)
      if (!text) {
        return []
      }

      return [createOrderedCandidate(cell, {
        avBlockId: attributeViewBlock.avBlockId,
        avID,
        columnName: headerNames[columnIndex] ?? '',
        columnIndex,
        itemID: rowID,
        keyID: resolveDomAttributeViewKeyId(cell, columnIndex),
        rowID,
        rowLabel: rowLabel || undefined,
        text,
        targetKind: 'cell' as const,
      })]
    })
  })
}

function resolveDomAttributeViewRows(blockElement: HTMLElement) {
  const explicitRows = Array.from(blockElement.querySelectorAll<HTMLElement>([
    '.av__row[data-id]',
    '.av__gallery-item[data-id]',
    '.av__card[data-id]',
    '.av__kanban-item[data-id]',
    '[data-item-id]',
    '[data-row-id]',
  ].join(', ')))
    .filter(rowElement => !rowElement.classList.contains('av__row--header'))
  if (explicitRows.length > 0) {
    return getTopLevelElements(explicitRows)
  }

  const fallbackRows = Array.from(blockElement.querySelectorAll<HTMLElement>('[data-id]'))
    .filter(rowElement => rowElement !== blockElement)
    .filter(rowElement => !rowElement.classList.contains('av__row--header'))
    .filter(rowElement => rowElement.querySelector('.av__cell, [data-av-key-id], [data-key-id], .av__celltext'))

  return getTopLevelElements(fallbackRows)
}

function resolveDomAttributeViewHeaderCells(blockElement: HTMLElement) {
  const headerCells = Array.from(blockElement.querySelectorAll<HTMLElement>('.av__row--header .av__cell.av__cell--header'))
  if (headerCells.length) {
    return headerCells
  }

  return Array.from(blockElement.querySelectorAll<HTMLElement>('.av__cell.av__cell--header'))
}

function getDomAttributeViewRowCells(rowElement: HTMLElement) {
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

function resolveDomAttributeViewKeyId(cellElement: HTMLElement, columnIndex: number) {
  return cellElement.dataset.avKeyId?.trim()
    || cellElement.dataset.keyId?.trim()
    || cellElement.dataset.colId?.trim()
    || cellElement.dataset.columnId?.trim()
    || cellElement.querySelector<HTMLElement>('[data-av-key-id]')?.dataset.avKeyId?.trim()
    || cellElement.querySelector<HTMLElement>('[data-key-id]')?.dataset.keyId?.trim()
    || cellElement.querySelector<HTMLElement>('[data-col-id]')?.dataset.colId?.trim()
    || cellElement.querySelector<HTMLElement>('[data-column-id]')?.dataset.columnId?.trim()
    || `__dom-col-${columnIndex}__`
}

function getAttributeViewDomText(element: HTMLElement) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
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

  const textParts: string[] = []
  let currentNode = walker.nextNode()
  while (currentNode) {
    textParts.push((currentNode as Text).nodeValue ?? '')
    currentNode = walker.nextNode()
  }

  return textParts.join('').replace(/\s+/g, ' ').trim()
}

function resolveDomAttributeViewRowId(rowElement: HTMLElement) {
  return rowElement.dataset.id?.trim()
    || rowElement.dataset.itemId?.trim()
    || rowElement.dataset.rowId?.trim()
    || undefined
}

function getTopLevelElements(elements: HTMLElement[]) {
  return elements.filter((element, index) => (
    elements.findIndex(candidate => candidate === element) === index
      && !elements.some(candidate => candidate !== element && candidate.contains(element))
  ))
}

function createOrderedCandidate(sourceElement: HTMLElement, candidate: AttributeViewCellCandidate) {
  return {
    candidate,
    sourceElement,
  }
}

function compareDomCandidateOrder(left: HTMLElement, right: HTMLElement) {
  if (left === right) {
    return 0
  }

  const position = left.compareDocumentPosition(right)
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
    return -1
  }
  if (position & Node.DOCUMENT_POSITION_PRECEDING) {
    return 1
  }

  return 0
}
