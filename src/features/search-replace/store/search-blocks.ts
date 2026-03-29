import { collectSearchableBlocks } from '../editor'
import { debugLog } from '../debug'
import { getDocumentContent } from '../kernel'
import type {
  EditorContext,
  SearchOptions,
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
      blocks: snapshot.blocks,
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
