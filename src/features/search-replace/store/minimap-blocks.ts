// 拆分自两处重复实现（RF-110）：store/loaded-block-range.ts 与
// ui/use-panel-minimap.ts 都需要按 blockId 查 blockIndex 的映射。

export function createBlockIndexByIdMap(
  minimapBlocks: ReadonlyArray<{ blockId: string, blockIndex: number }>,
) {
  return new Map(minimapBlocks.map((block) => [block.blockId, block.blockIndex] as const))
}
