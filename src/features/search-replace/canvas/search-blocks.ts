import type {
  EditorContext,
  SearchableBlock,
} from '../types'
import type {
  CanvasSearchTarget,
  CanvasSearchTargetField,
} from './types'

export function mapCanvasTargetsToSearchableBlocks({
  context,
  targets,
}: {
  context: EditorContext
  targets: CanvasSearchTarget[]
}): SearchableBlock[] {
  const host = context.canvas?.host
  return targets
    .filter(target => target.text.length > 0)
    .map((target, blockIndex) => ({
      blockId: `canvas:${target.id}`,
      blockIndex,
      blockTextLength: target.text.length,
      blockType: resolveCanvasBlockType(target.field),
      element: context.protyle,
      replaceable: target.replaceable,
      rootId: context.rootId,
      sourceKind: 'canvas',
      text: target.text,
      canvas: {
        field: target.field,
        filePath: context.canvas?.filePath,
        host,
        nodeId: target.nodeId,
        targetId: target.id,
        targetType: target.type,
      },
    }))
}

export async function resolveCanvasBlocksForSearch(context: EditorContext) {
  if (!context.canvas?.host) {
    return {
      blocks: [],
      documentContent: '',
    }
  }

  const snapshot = await context.canvas.host.getSnapshot()
  return {
    blocks: mapCanvasTargetsToSearchableBlocks({
      context,
      targets: snapshot.targets,
    }),
    documentContent: '',
  }
}

function resolveCanvasBlockType(field: CanvasSearchTargetField) {
  if (field === 'text') {
    return 'CanvasTextNode'
  }

  if (field === 'note') {
    return 'CanvasNoteNode'
  }

  return 'CanvasLabel'
}
