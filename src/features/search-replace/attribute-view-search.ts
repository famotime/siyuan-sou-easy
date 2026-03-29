import {
  buildPreview,
  getBlockElement,
  getUniqueBlockElements,
} from './editor'
import {
  getAttributeViewKeysByAvID,
  getBlockAttrs,
  renderAttributeView,
} from './kernel'
import { findMatches } from './search-engine'
import type {
  EditorContext,
  SearchMatch,
  SearchOptions,
  SearchableBlockSummary,
} from './types'

const ATTRIBUTE_VIEW_NODE_TYPE = 'NodeAttributeView'

interface AttributeViewBlockSummary {
  avBlockId: string
  avID?: string
  blockIndex: number
  element: HTMLElement
  rootId: string
  viewID?: string
}

interface AttributeViewCellCandidate {
  avBlockId: string
  avID: string
  columnName: string
  columnIndex?: number
  itemID?: string
  keyID: string
  rowID?: string
  rowLabel?: string
  text: string
  targetKind: 'cell' | 'column-header' | 'view-name'
}

interface SearchAttributeViewMatchesOptions {
  context: EditorContext
  documentContent?: string
  options: SearchOptions
  query: string
  startingBlockIndex: number
}

export async function searchAttributeViewMatches({
  context,
  documentContent = '',
  options,
  query,
  startingBlockIndex,
}: SearchAttributeViewMatchesOptions): Promise<{
  blocks: SearchableBlockSummary[]
  matches: SearchMatch[]
}> {
  if (!query.trim() || options.selectionOnly || !options.searchAttributeView) {
    return {
      blocks: [],
      matches: [],
    }
  }

  const attributeViewBlocks = collectAttributeViewBlocks(context, startingBlockIndex, documentContent)
  if (!attributeViewBlocks.length) {
    return {
      blocks: [],
      matches: [],
    }
  }

  const blocks: SearchableBlockSummary[] = []
  const matches: SearchMatch[] = []

  for (const attributeViewBlock of attributeViewBlocks) {
    blocks.push({
      blockId: attributeViewBlock.avBlockId,
      blockIndex: attributeViewBlock.blockIndex,
      blockType: ATTRIBUTE_VIEW_NODE_TYPE,
    })

    try {
      const { avID, viewID } = await resolveAttributeViewInfo(attributeViewBlock)
      if (!avID) {
        continue
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
      const cellCandidates = extractAttributeViewSearchCandidates({
        attributeViewBlock,
        avID,
        columnIndexByKeyId,
        keyNameById,
        renderedAttributeView,
      })
      if (!cellCandidates.length) {
        continue
      }

      const candidateBySyntheticBlockId = new Map<string, AttributeViewCellCandidate>()
      const searchResult = findMatches(
        cellCandidates.map((candidate, index) => {
          const syntheticBlockId = `${candidate.avBlockId}::${candidate.targetKind}::${candidate.itemID ?? candidate.rowID ?? candidate.keyID}:${index}`
          candidateBySyntheticBlockId.set(syntheticBlockId, candidate)
          return {
            blockId: syntheticBlockId,
            blockIndex: attributeViewBlock.blockIndex,
            blockType: ATTRIBUTE_VIEW_NODE_TYPE,
            element: attributeViewBlock.element,
            rootId: attributeViewBlock.rootId,
            text: candidate.text,
          }
        }),
        query,
        options,
      )

      searchResult.matches.forEach((match) => {
        const candidate = candidateBySyntheticBlockId.get(match.blockId)
        if (!candidate) {
          return
        }

        const preview = buildPreview(candidate.text, match.start, match.end)
        matches.push({
          ...match,
          attributeView: {
            avBlockId: candidate.avBlockId,
            avID: candidate.avID,
            columnName: candidate.columnName,
            columnIndex: candidate.columnIndex,
            itemID: candidate.itemID,
            keyID: candidate.keyID,
            rowID: candidate.rowID,
            rowLabel: candidate.rowLabel,
            targetKind: candidate.targetKind,
          },
          blockId: candidate.avBlockId,
          id: `av:${candidate.avBlockId}:${candidate.targetKind}:${candidate.itemID ?? candidate.rowID ?? candidate.keyID}:${match.start}:${match.end}`,
          previewText: buildAttributeViewPreviewText(candidate, preview),
          replaceable: false,
          sourceKind: 'attribute-view',
        })
      })
    } catch {
      continue
    }
  }

  return {
    blocks,
    matches,
  }
}

async function resolveAttributeViewInfo(attributeViewBlock: AttributeViewBlockSummary) {
  if (attributeViewBlock.avID && attributeViewBlock.viewID) {
    return {
      avID: attributeViewBlock.avID,
      viewID: attributeViewBlock.viewID,
    }
  }

  const blockAttrs = await getBlockAttrs(attributeViewBlock.avBlockId)
  return {
    avID: attributeViewBlock.avID || parseAttributeViewId(blockAttrs),
    viewID: attributeViewBlock.viewID || parseAttributeViewViewId(blockAttrs),
  }
}

function collectAttributeViewBlocks(context: EditorContext, startingBlockIndex: number, documentContent: string): AttributeViewBlockSummary[] {
  const fromDocumentContent = collectAttributeViewBlocksFromDocumentContent(context, startingBlockIndex, documentContent)
  if (fromDocumentContent.length > 0) {
    return fromDocumentContent
  }

  return getUniqueBlockElements(context.protyle)
    .filter(element => element.dataset.type === ATTRIBUTE_VIEW_NODE_TYPE)
    .map((element, index) => ({
      avBlockId: element.dataset.nodeId ?? `attribute-view-${index}`,
      avID: element.dataset.avId?.trim() || undefined,
      blockIndex: startingBlockIndex + index,
      element,
      rootId: context.rootId,
      viewID: resolveAttributeViewViewIdFromElement(element),
    }))
}

function collectAttributeViewBlocksFromDocumentContent(
  context: EditorContext,
  startingBlockIndex: number,
  documentContent: string,
) {
  if (!documentContent.trim()) {
    return []
  }

  const container = document.createElement('div')
  container.innerHTML = documentContent
  const seen = new Set<string>()

  return Array.from(container.querySelectorAll<HTMLElement>(`[data-type="${ATTRIBUTE_VIEW_NODE_TYPE}"][data-node-id]`))
    .filter((element) => {
      const blockId = element.dataset.nodeId
      if (!blockId || seen.has(blockId)) {
        return false
      }

      seen.add(blockId)
      return true
    })
    .map((element, index) => {
      const avBlockId = element.dataset.nodeId ?? `attribute-view-${index}`
      return {
        avBlockId,
        avID: element.dataset.avId?.trim() || undefined,
        blockIndex: startingBlockIndex + index,
        element: getBlockElement(context, avBlockId) ?? element,
        rootId: context.rootId,
        viewID: resolveAttributeViewViewIdFromElement(element),
      }
    })
}

function parseAttributeViewId(blockAttrs: Record<string, string>) {
  const rawValue = blockAttrs['custom-avs']
  if (!rawValue) {
    return ''
  }

  try {
    const parsed = JSON.parse(rawValue)
    if (Array.isArray(parsed)) {
      const firstValue = parsed.find(value => typeof value === 'string' && value.trim())
      return typeof firstValue === 'string' ? firstValue : ''
    }
  } catch {
    const matched = rawValue.match(/\d{14}-[a-z0-9]+/i)
    return matched?.[0] ?? rawValue.trim()
  }

  return ''
}

function parseAttributeViewViewId(blockAttrs: Record<string, string>) {
  return blockAttrs['custom-sy-av-view']?.trim() ?? ''
}

function resolveAttributeViewViewIdFromElement(element: HTMLElement) {
  return element.dataset.avViewId?.trim()
    || element.dataset.syAvView?.trim()
    || element.getAttribute('data-av-view-id')?.trim()
    || element.getAttribute('custom-sy-av-view')?.trim()
    || ''
}

function extractAttributeViewSearchCandidates({
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
    ...extractAttributeViewTitleCandidates({
      attributeViewBlock,
      avID,
      renderedAttributeView,
    }),
    ...extractAttributeViewColumnHeaderCandidates({
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

function extractAttributeViewTitleCandidates({
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

function extractAttributeViewColumnHeaderCandidates({
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

function buildAttributeViewPreviewText(candidate: AttributeViewCellCandidate, preview: string) {
  if (candidate.targetKind === 'cell') {
    return `${candidate.columnName}: ${preview}`
  }

  return preview
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
  return Array.isArray(view.columns)
    ? view.columns.filter((column: any) => column?.hidden !== true)
    : []
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

function resolveKeyName(key: Record<string, any>) {
  const text = extractSearchableText(key)
  return text || String(key.id ?? key.keyID ?? '')
}

function extractSearchableText(value: any): string {
  if (typeof value === 'string') {
    return value.trim()
  }
  if (typeof value === 'number') {
    return String(value)
  }
  if (!value || typeof value !== 'object') {
    return ''
  }
  if (Array.isArray(value)) {
    return value
      .map(item => extractSearchableText(item))
      .filter(Boolean)
      .join(' ')
      .trim()
  }

  const typedText = extractTypedSearchableText(value)
  if (typedText) {
    return typedText
  }

  const directKeys = [
    'formattedContent',
    'content',
    'displayContent',
    'name',
    'title',
    'label',
  ]
  for (const key of directKeys) {
    const text = extractSearchableText(value[key])
    if (text) {
      return text
    }
  }

  const nestedKeys = [
    'block',
    'date',
    'mAsset',
    'mSelect',
    'number',
    'relation',
    'rollup',
    'select',
    'text',
  ]
  for (const key of nestedKeys) {
    const text = extractSearchableText(value[key])
    if (text) {
      return text
    }
  }

  return ''
}

function extractTypedSearchableText(value: Record<string, any>) {
  const valueType = String(value.type ?? value.valueType ?? '').toLowerCase()
  switch (valueType) {
    case 'block':
      return extractSearchableText(value.block ?? value.text ?? '')
    case 'checkbox':
      return value.checkbox?.checked ? 'true' : ''
    case 'created':
    case 'createdat':
      return formatAttributeViewTimestamp(value.created ?? value.createdAt ?? value.date ?? value)
    case 'date':
      return formatAttributeViewDate(value.date ?? value)
    case 'masset':
      return extractAssetSearchableText(value.mAsset ?? value)
    case 'mselect':
      return extractSearchableText(value.mSelect ?? value.select ?? [])
    case 'number':
      return extractNumberSearchableText(value.number ?? value)
    case 'relation':
      return extractRelationSearchableText(value.relation ?? value)
    case 'rollup':
      return extractRollupSearchableText(value.rollup ?? value)
    case 'select':
      return extractSearchableText(value.select ?? value.mSelect ?? [])
    case 'text':
      return extractSearchableText(value.text ?? value)
    case 'updated':
    case 'updatedat':
      return formatAttributeViewTimestamp(value.updated ?? value.updatedAt ?? value.date ?? value)
    default:
      break
  }

  if (value.mAsset) {
    return extractAssetSearchableText(value.mAsset)
  }
  if (value.relation) {
    return extractRelationSearchableText(value.relation)
  }
  if (value.rollup) {
    return extractRollupSearchableText(value.rollup)
  }
  if (value.date) {
    return formatAttributeViewDate(value.date)
  }
  if (value.number) {
    return extractNumberSearchableText(value.number)
  }

  return ''
}

function extractAssetSearchableText(assets: any) {
  if (!Array.isArray(assets)) {
    return ''
  }

  return assets
    .flatMap((asset) => [
      extractSearchableText(asset?.name),
      extractSearchableText(asset?.content),
    ])
    .filter(Boolean)
    .join(' ')
    .trim()
}

function extractNumberSearchableText(numberValue: any) {
  if (!numberValue || typeof numberValue !== 'object') {
    return extractSearchableText(numberValue)
  }

  return extractSearchableText(numberValue.formattedContent)
    || extractSearchableText(numberValue.content)
}

function extractRelationSearchableText(relationValue: any) {
  if (!relationValue || typeof relationValue !== 'object') {
    return ''
  }

  return extractSearchableText(relationValue.contents ?? relationValue.blockIDs ?? [])
}

function extractRollupSearchableText(rollupValue: any) {
  if (!rollupValue || typeof rollupValue !== 'object') {
    return ''
  }

  return extractSearchableText(rollupValue.contents ?? [])
}

function formatAttributeViewDate(dateValue: any) {
  if (!dateValue || typeof dateValue !== 'object') {
    return extractSearchableText(dateValue)
  }

  const formatted = extractSearchableText(dateValue.formattedContent)
  if (formatted) {
    return formatted
  }

  const parts = [
    formatAttributeViewTimestamp(dateValue.content, !dateValue.isNotTime),
  ]
  if (dateValue.hasEndDate && dateValue.isNotEmpty2) {
    const end = formatAttributeViewTimestamp(dateValue.content2, !dateValue.isNotTime)
    if (end) {
      parts.push(end)
    }
  }

  return parts.filter(Boolean).join(' ').trim()
}

function formatAttributeViewTimestamp(rawValue: any, includeTime = true) {
  const timestamp = Number(rawValue)
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return ''
  }

  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  if (!includeTime) {
    return `${year}-${month}-${day}`
  }

  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}
