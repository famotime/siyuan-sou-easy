import {
  collectSearchableBlocksFromDocumentContent,
  collectSearchableBlocks,
} from '../editor'
import type {
  EditorContext,
  SearchOptions,
  SearchableBlock,
} from '../types'

interface SnapshotCacheEntry {
  blocks: SearchableBlock[]
  includeCodeBlock: boolean
  rootId: string
}

let snapshotCache: SnapshotCacheEntry | null = null

interface ResolveDocumentBlocksDependencies {
  context: EditorContext
  fetchDocumentContent: typeof import('../kernel').getDocumentContent
  options: SearchOptions
}

export async function resolveDocumentBlocks({
  context,
  fetchDocumentContent,
  options,
}: ResolveDocumentBlocksDependencies) {
  if (
    snapshotCache
    && snapshotCache.rootId === context.rootId
    && snapshotCache.includeCodeBlock === options.includeCodeBlock
  ) {
    return snapshotCache.blocks
  }

  const snapshot = await fetchDocumentContent(context.rootId)
  const blocks = snapshot?.content
    ? collectSearchableBlocksFromDocumentContent(snapshot.content, context.rootId, options)
    : collectSearchableBlocks(context, options)

  snapshotCache = {
    blocks,
    includeCodeBlock: options.includeCodeBlock,
    rootId: context.rootId,
  }

  return blocks
}

export function invalidateDocumentSnapshot(rootId?: string) {
  if (!snapshotCache) {
    return
  }

  if (!rootId || snapshotCache.rootId === rootId) {
    snapshotCache = null
  }
}

export function clearDocumentSnapshotCache() {
  snapshotCache = null
}
