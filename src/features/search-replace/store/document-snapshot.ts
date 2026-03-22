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
  content: string
  includeCodeBlock: boolean
  rootId: string
}

let snapshotCache: SnapshotCacheEntry | null = null

interface ResolveDocumentBlocksDependencies {
  context: EditorContext
  fetchDocumentContent: typeof import('../kernel').getDocumentContent
  options: SearchOptions
}

export async function resolveDocumentSnapshot({
  context,
  fetchDocumentContent,
  options,
}: ResolveDocumentBlocksDependencies) {
  if (
    snapshotCache
    && snapshotCache.rootId === context.rootId
    && snapshotCache.includeCodeBlock === options.includeCodeBlock
  ) {
    return snapshotCache
  }

  const snapshot = await fetchDocumentContent(context.rootId)
  const content = snapshot?.content ?? ''
  const blocks = content
    ? collectSearchableBlocksFromDocumentContent(content, context.rootId, options)
    : collectSearchableBlocks(context, options)

  snapshotCache = {
    blocks,
    content,
    includeCodeBlock: options.includeCodeBlock,
    rootId: context.rootId,
  }

  return snapshotCache
}

export async function resolveDocumentBlocks(dependencies: ResolveDocumentBlocksDependencies) {
  const snapshot = await resolveDocumentSnapshot(dependencies)
  return snapshot.blocks
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
