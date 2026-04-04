import { collectSearchableBlocks } from '../editor'
import { debugLog } from '../debug'
import { getDocumentContent } from '../kernel'
import type {
  EditorContext,
  SearchOptions,
  SearchableBlock,
} from '../types'
import { resolveDocumentSnapshot } from './document-snapshot'

export async function resolveBlocksForSearch(context: EditorContext, options: SearchOptions) {
  const liveBlocks = collectSearchableBlocks(context, options)
  if (options.selectionOnly) {
    return {
      blocks: liveBlocks,
      documentContent: '',
    }
  }

  try {
    const snapshot = await resolveDocumentSnapshot({
      context,
      fetchDocumentContent: getDocumentContent,
      options,
    })
    return {
      blocks: mergeLiveBlocksIntoSnapshot(snapshot.blocks, liveBlocks),
      documentContent: snapshot.content,
    }
  } catch (error) {
    debugLog('document-snapshot:failed', {
      error: error instanceof Error ? error.message : String(error),
      rootId: context.rootId,
    })
    return {
      blocks: liveBlocks,
      documentContent: '',
    }
  }
}

function mergeLiveBlocksIntoSnapshot(snapshotBlocks: SearchableBlock[], liveBlocks: SearchableBlock[]) {
  if (!snapshotBlocks.length) {
    return liveBlocks
  }

  if (!liveBlocks.length) {
    return snapshotBlocks
  }

  const liveBlockById = new Map(liveBlocks.map(block => [block.blockId, block]))
  const mergedBlocks = snapshotBlocks.map((snapshotBlock) => {
    const liveBlock = liveBlockById.get(snapshotBlock.blockId)
    if (!liveBlock) {
      return snapshotBlock
    }

    liveBlockById.delete(snapshotBlock.blockId)
    return {
      ...liveBlock,
      blockIndex: snapshotBlock.blockIndex,
    }
  })

  if (!liveBlockById.size) {
    return mergedBlocks
  }

  const nextBlockIndex = mergedBlocks.length
  return [
    ...mergedBlocks,
    ...Array.from(liveBlockById.values()).map((block, index) => ({
      ...block,
      blockIndex: nextBlockIndex + index,
    })),
  ]
}
