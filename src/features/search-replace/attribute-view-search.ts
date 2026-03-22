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
      const avID = attributeViewBlock.avID || await resolveAttributeViewId(attributeViewBlock.avBlockId)
      if (!avID) {
        continue
      }

      const [renderedAttributeView, attributeViewKeys] = await Promise.all([
        renderAttributeView(avID),
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
      const cellCandidates = extractAttributeViewCellCandidates({
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
          const syntheticBlockId = `${candidate.avBlockId}::${candidate.itemID ?? candidate.rowID ?? 'row'}::${candidate.keyID}:${index}`
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
          },
          blockId: candidate.avBlockId,
          id: `av:${candidate.avBlockId}:${candidate.itemID ?? candidate.rowID ?? 'row'}:${candidate.keyID}:${match.start}:${match.end}`,
          previewText: `${candidate.columnName}: ${preview}`,
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

async function resolveAttributeViewId(avBlockId: string) {
  const blockAttrs = await getBlockAttrs(avBlockId)
  return parseAttributeViewId(blockAttrs)
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

function extractAttributeViewCellCandidates({
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
  const rows = resolveAttributeViewRows(renderedAttributeView)
  return rows.flatMap((row) => {
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
      }]
    })
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
  return Array.isArray(view.columns) ? view.columns : []
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

  const directKeys = [
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
    'mSelect',
    'number',
    'relation',
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
