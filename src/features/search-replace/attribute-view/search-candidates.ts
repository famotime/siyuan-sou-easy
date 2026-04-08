import {
  getAttributeViewKeysByAvID,
  renderAttributeView,
} from '../kernel'
import { extractSearchableText, resolveKeyName } from './search-values'
import {
  mergeAttributeViewSearchCandidates,
  shouldReturnDomCandidatesOnly,
  shouldUseRenderedAttributeViewCandidates,
} from './search-candidate-policy'
import { extractDomAttributeViewSearchCandidates } from './search-dom-candidates'
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
  if (shouldReturnDomCandidatesOnly(domCandidates)) {
    return mergeAttributeViewSearchCandidates(domCandidates, [])
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

  if (!shouldUseRenderedAttributeViewCandidates({
    attributeViewTypeHint: resolveAttributeViewTypeHint(attributeViewBlock),
    renderedAttributeView,
    requestedViewID: viewID,
  })) {
    return mergeAttributeViewSearchCandidates(domCandidates, [])
  }

  const renderedCandidates = extractRenderedAttributeViewSearchCandidates({
    attributeViewBlock,
    avID,
    columnIndexByKeyId,
    keyNameById,
    renderedAttributeView,
  })

  return mergeAttributeViewSearchCandidates(domCandidates, renderedCandidates)
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
    ...extractRenderedAttributeViewGroupTitleCandidates({
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

function extractRenderedAttributeViewGroupTitleCandidates({
  attributeViewBlock,
  avID,
  renderedAttributeView,
}: {
  attributeViewBlock: AttributeViewBlockSummary
  avID: string
  renderedAttributeView: any
}) {
  const view = renderedAttributeView?.view ?? renderedAttributeView ?? {}
  if (!Array.isArray(view.groups)) {
    return []
  }

  const seen = new Set<string>()
  return view.groups.flatMap((group: any, index: number) => {
    const text = extractSearchableText(
      group?.title
      ?? group?.name
      ?? group?.label
      ?? group?.value
      ?? group?.groupValue
      ?? '',
    )
    if (!text || seen.has(text)) {
      return []
    }

    seen.add(text)
    return [{
      avBlockId: attributeViewBlock.avBlockId,
      avID,
      columnName: text,
      keyID: `__group-title-${String(group?.id ?? index)}__`,
      text,
      targetKind: 'group-title' as const,
    }]
  })
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

function resolveAttributeViewTypeHint(attributeViewBlock: AttributeViewBlockSummary) {
  return attributeViewBlock.element.dataset.avType?.trim().toLowerCase()
    || attributeViewBlock.element.getAttribute('data-av-type')?.trim().toLowerCase()
    || ''
}
