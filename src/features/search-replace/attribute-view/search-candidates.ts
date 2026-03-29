import {
  getAttributeViewKeysByAvID,
  renderAttributeView,
} from '../kernel'
import { extractSearchableText, resolveKeyName } from './search-values'
import type {
  AttributeViewBlockSummary,
  AttributeViewCellCandidate,
} from './search-types'

interface ResolveAttributeViewSearchCandidatesOptions {
  attributeViewBlock: AttributeViewBlockSummary
  avID: string
  viewID?: string
}

export async function resolveAttributeViewSearchCandidates({
  attributeViewBlock,
  avID,
  viewID,
}: ResolveAttributeViewSearchCandidatesOptions) {
  const domCandidates = extractDomAttributeViewSearchCandidates({
    attributeViewBlock,
    avID,
  })
  if (domCandidates.length > 0) {
    return domCandidates
  }

  const [renderedAttributeView, attributeViewKeys] = await Promise.all([
    viewID ? renderAttributeView(avID, viewID) : renderAttributeView(avID),
    getAttributeViewKeysByAvID(avID),
  ])
  const columnIndexByKeyId = new Map(
    resolveAttributeViewColumns(renderedAttributeView)
      .map((column: any, index: number) => [String(column?.id ?? ''), index] as const)
      .filter(([id]) => Boolean(id)),
  )
  const keyNameById = new Map(
    attributeViewKeys.map(key => [String(key.id ?? key.keyID ?? ''), resolveKeyName(key)] as const),
  )

  return extractRenderedAttributeViewSearchCandidates({
    attributeViewBlock,
    avID,
    columnIndexByKeyId,
    keyNameById,
    renderedAttributeView,
  })
}

function extractDomAttributeViewSearchCandidates({
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
  const headerNames = headerCandidates.map(candidate => candidate.columnName)
  const rowCandidates = collectDomAttributeViewRowCandidates({
    attributeViewBlock,
    avID,
    blockElement,
    headerNames,
  })

  return [
    ...titleCandidates,
    ...headerCandidates,
    ...rowCandidates,
  ]
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
    return [{
      avBlockId: attributeViewBlock.avBlockId,
      avID,
      columnName: text,
      keyID: `__dom-view-name-${index}__`,
      text,
      targetKind: 'view-name' as const,
    }]
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

    return [{
      avBlockId: attributeViewBlock.avBlockId,
      avID,
      columnName: text,
      columnIndex,
      keyID: resolveDomAttributeViewKeyId(cell, columnIndex),
      text,
      targetKind: 'column-header' as const,
    }]
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
    const rowID = rowElement.dataset.id?.trim() || undefined
    const rowCells = getDomAttributeViewRowCells(rowElement)
    const rowLabel = rowCells
      .map(cell => getAttributeViewDomText(cell))
      .find(Boolean)

    return rowCells.flatMap((cell, columnIndex) => {
      const text = getAttributeViewDomText(cell)
      if (!text) {
        return []
      }

      return [{
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
      }]
    })
  })
}

function extractRenderedAttributeViewSearchCandidates({
  attributeViewBlock,
  avID,
  columnIndexByKeyId,
  keyNameById,
  renderedAttributeView,
}: {
  attributeViewBlock: AttributeViewBlockSummary
  avID: string
  columnIndexByKeyId: Map<string, number>
  keyNameById: Map<string, string>
  renderedAttributeView: any
}): AttributeViewCellCandidate[] {
  const candidates: AttributeViewCellCandidate[] = [
    ...extractRenderedAttributeViewTitleCandidates({
      attributeViewBlock,
      avID,
      renderedAttributeView,
    }),
    ...extractRenderedAttributeViewColumnHeaderCandidates({
      attributeViewBlock,
      avID,
      renderedAttributeView,
    }),
  ]
  const rows = resolveAttributeViewRows(renderedAttributeView)
  candidates.push(...rows.flatMap((row) => {
    const rowID = resolveRowId(row)
    const rowLabel = resolveRowLabel(row)
    return resolveRowCells(row).flatMap((cell) => {
      const keyID = String(cell.keyID ?? cell.id ?? cell.columnID ?? cell.fieldID ?? '')
      if (!keyID) {
        return []
      }

      const text = extractSearchableText(cell.value ?? cell)
      if (!text) {
        return []
      }

      return [{
        avBlockId: attributeViewBlock.avBlockId,
        avID,
        columnName: keyNameById.get(keyID) ?? keyID,
        columnIndex: columnIndexByKeyId.get(keyID),
        itemID: row.itemID ?? row.id,
        keyID,
        rowID,
        rowLabel,
        text,
        targetKind: 'cell',
      }]
    })
  }))

  return candidates
}

function extractRenderedAttributeViewTitleCandidates({
  attributeViewBlock,
  avID,
  renderedAttributeView,
}: {
  attributeViewBlock: AttributeViewBlockSummary
  avID: string
  renderedAttributeView: any
}) {
  const names = [
    extractSearchableText(renderedAttributeView?.name),
    extractSearchableText(renderedAttributeView?.view?.name),
  ].filter(Boolean)
  const seen = new Set<string>()

  return names.flatMap((name, index) => {
    if (seen.has(name)) {
      return []
    }

    seen.add(name)
    return [{
      avBlockId: attributeViewBlock.avBlockId,
      avID,
      columnName: name,
      keyID: `__view-name-${index}__`,
      text: name,
      targetKind: 'view-name' as const,
    }]
  })
}

function extractRenderedAttributeViewColumnHeaderCandidates({
  attributeViewBlock,
  avID,
  renderedAttributeView,
}: {
  attributeViewBlock: AttributeViewBlockSummary
  avID: string
  renderedAttributeView: any
}) {
  return resolveAttributeViewColumns(renderedAttributeView).flatMap((column: any, index: number) => {
    const text = extractSearchableText(column?.name)
    const keyID = String(column?.id ?? '')
    if (!text || !keyID) {
      return []
    }

    return [{
      avBlockId: attributeViewBlock.avBlockId,
      avID,
      columnName: text,
      columnIndex: index,
      keyID,
      text,
      targetKind: 'column-header' as const,
    }]
  })
}

function resolveAttributeViewRows(renderedAttributeView: any) {
  const view = renderedAttributeView?.view ?? renderedAttributeView ?? {}
  if (Array.isArray(view.rows)) {
    return view.rows
  }
  if (Array.isArray(view.cards)) {
    return view.cards
  }
  if (Array.isArray(view.groups)) {
    return view.groups.flatMap((group: any) => group.rows ?? group.cards ?? [])
  }
  return []
}

function resolveAttributeViewColumns(renderedAttributeView: any) {
  const view = renderedAttributeView?.view ?? renderedAttributeView ?? {}
  const columns = Array.isArray(view.columns)
    ? view.columns
    : Array.isArray(view.fields)
      ? view.fields
      : []
  return columns.filter((column: any) => column?.hidden !== true)
}

function resolveRowCells(row: any) {
  if (Array.isArray(row.cells)) {
    return row.cells
  }
  if (Array.isArray(row.values)) {
    return row.values
  }
  if (Array.isArray(row.fields)) {
    return row.fields
  }
  return []
}

function resolveRowId(row: any) {
  return row.rowID ?? row.itemID ?? row.id
}

function resolveRowLabel(row: any) {
  const label = extractSearchableText(row?.block ?? row?.primary ?? row?.title ?? '')
  return label || undefined
}

function resolveDomAttributeViewRows(blockElement: HTMLElement) {
  return Array.from(blockElement.querySelectorAll<HTMLElement>('.av__row[data-id], .av__gallery-item[data-id]'))
    .filter(rowElement => !rowElement.classList.contains('av__row--header'))
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

  return Array.from(body.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement)
    .filter(child => child.classList.contains('av__cell'))
    .filter(child => !child.classList.contains('av__cell--header'))
}

function resolveDomAttributeViewKeyId(cellElement: HTMLElement, columnIndex: number) {
  return cellElement.dataset.avKeyId?.trim()
    || cellElement.dataset.keyId?.trim()
    || cellElement.querySelector<HTMLElement>('[data-av-key-id]')?.dataset.avKeyId?.trim()
    || cellElement.querySelector<HTMLElement>('[data-key-id]')?.dataset.keyId?.trim()
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
