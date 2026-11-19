import type {
  EditorContext,
  SearchableBlockSummary,
  SearchMatch,
  SearchOptions,
} from '../types'
import type { AttributeViewCellCandidate } from './search-types'
import { debugLog } from '../debug'
import { buildPreview } from '../editor'
import { findMatches } from '../search-engine'
import {
  collectAttributeViewBlocks,
  resolveAttributeViewInfo,
} from './search-blocks'
import { resolveAttributeViewSearchCandidates } from './search-candidates'
import {
  ATTRIBUTE_VIEW_NODE_TYPE,

} from './search-types'

export interface SearchAttributeViewMatchesOptions {
  context: EditorContext
  documentContent?: string
  /**
   * 过期判定回调：搜索被更新的一次刷新取代时返回 true，循环立即中止。
   * 每个 AV 块的候选采集都伴随内核请求，缺少该检查时过期搜索会把
   * 内核 API 打满（历史行为），由调用方以 revision guard 驱动。
   */
  isStale?: () => boolean
  options: SearchOptions
  query: string
  startingBlockIndex: number
}

export async function searchAttributeViewMatches({
  context,
  documentContent = '',
  isStale,
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
    if (isStale?.()) {
      debugLog('attribute-view-search:stale', {
        avBlockId: attributeViewBlock.avBlockId,
        remainingBlocks: attributeViewBlocks.length - blocks.length,
      })
      break
    }

    try {
      const {
        avID,
        viewID,
      } = await resolveAttributeViewInfo(attributeViewBlock)
      if (!avID) {
        continue
      }

      if (isStale?.()) {
        debugLog('attribute-view-search:stale', {
          avBlockId: attributeViewBlock.avBlockId,
          stage: 'after-resolve-info',
        })
        break
      }

      const candidates = await resolveAttributeViewSearchCandidates({
        attributeViewBlock,
        avID,
        viewID,
      })
      if (!candidates.length) {
        continue
      }

      // 块摘要仅在成功完成候选采集后计入，保证 searchableBlockCount
      // 与实际完成搜索的块一致（失败块此前会被提前计入导致计数虚高）。
      blocks.push({
        blockId: attributeViewBlock.avBlockId,
        blockIndex: attributeViewBlock.blockIndex,
        blockType: ATTRIBUTE_VIEW_NODE_TYPE,
      })

      matches.push(...buildAttributeViewMatches({
        attributeViewBlock,
        candidates,
        options,
        query,
      }))
    } catch (error) {
      debugLog('attribute-view-search:block-failed', {
        avBlockId: attributeViewBlock.avBlockId,
        error: error instanceof Error ? error.message : String(error),
      })
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
  const candidateBySyntheticBlockId = new Map<string, {
    candidate: AttributeViewCellCandidate
    visualIndex: number
  }>()
  const searchResult = findMatches(
    candidates.map((candidate, index) => {
      const syntheticBlockId = `${candidate.avBlockId}::${candidate.targetKind}::${candidate.itemID ?? candidate.rowID ?? candidate.keyID}:${index}`
      candidateBySyntheticBlockId.set(syntheticBlockId, {
        candidate,
        visualIndex: index,
      })
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
    const resolvedCandidate = candidateBySyntheticBlockId.get(match.blockId)
    if (!resolvedCandidate) {
      return []
    }

    const {
      candidate,
      visualIndex,
    } = resolvedCandidate
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
        visualIndex,
      },
      blockId: candidate.avBlockId,
      id: `av:${candidate.avBlockId}:${candidate.targetKind}:${candidate.itemID ?? candidate.rowID ?? ''}:${candidate.keyID}:${match.matchedText}:${match.occ}`,
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
