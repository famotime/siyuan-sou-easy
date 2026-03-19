export {
  createEditorContextFromElement,
  createEditorContextFromProtyleLike,
  findEditorContextByRootId,
  getActiveEditorContext,
} from './editor/context'
export {
  collectSearchableBlocks,
  collectSearchableBlocksFromDocumentContent,
  createBlockElementFromDom,
  getBlockElement,
  getBlockPlainText,
} from './editor/blocks'
export {
  getCurrentSelectionScope,
  getCurrentSelectionText,
} from './editor/selection'
export {
  buildPreview,
  clearSearchDecorations,
  scrollMatchIntoView,
  syncSearchDecorations,
} from './editor/decorations'
export {
  applyReplacementsToClone,
  isRangeReplaceable,
} from './editor/replacement'
