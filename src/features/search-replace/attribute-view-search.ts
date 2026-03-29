import { buildPreview } from './editor'
import { findMatches } from './search-engine'
import type {
  EditorContext,
  SearchMatch,
  SearchOptions,
  SearchableBlockSummary,
} from './types'
import { collectAttributeViewBlocks, resolveAttributeViewInfo } from './attribute-view/search-blocks'
import { resolveAttributeViewSearchCandidates } from './attribute-view/search-candidates'
import {
  ATTRIBUTE_VIEW_NODE_TYPE,
  type AttributeViewCellCandidate,
} from './attribute-view/search-types'

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

      const candidates = await resolveAttributeViewSearchCandidates({
        attributeViewBlock,
        avID,
        viewID,
      })
      if (!candidates.length) {
        continue
      }

      matches.push(...buildAttributeViewMatches({
        attributeViewBlock,
        candidates,
        options,
        query,
      }))
    } catch {
      continue
    }
  }

  return {
    blocks,
    matches,
  }
}

function buildAttributeViewMatches({
  attributeViewBlock,
  candidates,
  options,
  query,
}: {
  attributeViewBlock: {
    avBlockId: string
    blockIndex: number
    element: HTMLElement
    rootId: string
  }
  candidates: AttributeViewCellCandidate[]
  options: SearchOptions
  query: string
}) {
  const candidateBySyntheticBlockId = new Map<string, AttributeViewCellCandidate>()
  const searchResult = findMatches(
    candidates.map((candidate, index) => {
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

  return searchResult.matches.flatMap((match) => {
    const candidate = candidateBySyntheticBlockId.get(match.blockId)
    if (!candidate) {
      return []
    }

    const preview = buildPreview(candidate.text, match.start, match.end)
    return [{
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
      sourceKind: 'attribute-view' as const,
    }]
  })
}

function buildAttributeViewPreviewText(candidate: AttributeViewCellCandidate, preview: string) {
  if (candidate.targetKind === 'cell' && candidate.columnName.trim()) {
    return `${candidate.columnName}: ${preview}`
  }

  return preview
}
