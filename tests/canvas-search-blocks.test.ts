import { describe, expect, it } from 'vitest'

import {
  mapCanvasTargetsToSearchableBlocks,
  resolveCanvasBlocksForSearch,
} from '@/features/search-replace/canvas/search-blocks'

describe('canvas search block mapping', () => {
  it('maps canvas targets to searchable blocks with explicit replaceability', () => {
    const host = {} as any
    const blocks = mapCanvasTargetsToSearchableBlocks({
      context: {
        rootId: 'canvas:/data/storage/canvas/a.canvas',
        title: 'a.canvas',
        protyle: {} as HTMLElement,
        sourceKind: 'canvas',
        canvas: {
          filePath: '/data/storage/canvas/a.canvas',
          host,
        },
      } as any,
      targets: [
        { id: 'node:t1:text', nodeId: 't1', type: 'node', field: 'text', text: 'Alpha', title: 'Alpha', replaceable: true },
        { id: 'node:f1:note', nodeId: 'f1', type: 'node', field: 'note', text: 'Alpha doc', title: 'Doc', replaceable: false },
      ],
    })

    expect(blocks.map(block => ({
      blockId: block.blockId,
      blockType: block.blockType,
      replaceable: block.replaceable,
      text: block.text,
      targetId: block.canvas?.targetId,
    }))).toEqual([
      { blockId: 'canvas:node:t1:text', blockType: 'CanvasTextNode', replaceable: true, text: 'Alpha', targetId: 'node:t1:text' },
      { blockId: 'canvas:node:f1:note', blockType: 'CanvasNoteNode', replaceable: false, text: 'Alpha doc', targetId: 'node:f1:note' },
    ])
  })

  it('resolves canvas blocks from the host snapshot', async () => {
    const host = {
      getSnapshot: async () => ({
        revision: 'r1',
        targets: [
          { id: 'node:t1:text', nodeId: 't1', type: 'node', field: 'text', text: 'Alpha', title: 'Alpha', replaceable: true },
        ],
      }),
    }
    const result = await resolveCanvasBlocksForSearch({
      rootId: 'canvas:/data/a.canvas',
      title: 'a.canvas',
      protyle: {} as HTMLElement,
      sourceKind: 'canvas',
      canvas: { filePath: '/data/a.canvas', host },
    } as any)

    expect(result.documentContent).toBe('')
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0]?.canvas?.host).toBe(host)
  })
})
