export {
  collectSearchableBlocks,
  collectSearchableBlocksFromDocumentContent,
  createBlockElementFromDom,
  getBlockElement,
  getBlockPlainText,
  getBlockTextLength,
  getUniqueBlockElements,
} from './editor/blocks'
export {
  createEditorContextFromElement,
  createEditorContextFromProtyleLike,
  type EditorProtyleLike,
  findEditorContextByRootId,
  getActiveEditorContext,
} from './editor/context'
export {
  clearSearchDecorations,
  syncSearchDecorations,
} from './editor/decorations'
export {
  isMatchVisible,
  scrollMatchIntoView,
} from './editor/match-scroll'
export {
  applyReplacementsToClone,
  isRangeReplaceable,
} from './editor/replacement'
export {
  getCurrentSelectionScope,
  getCurrentSelectionText,
} from './editor/selection'
export { buildPreview } from './match-utils'
