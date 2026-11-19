export {
  createEditorContextFromElement,
  createEditorContextFromProtyleLike,
  findEditorContextByRootId,
  getActiveEditorContext,
  type EditorProtyleLike,
} from './editor/context'
export {
  collectSearchableBlocks,
  collectSearchableBlocksFromDocumentContent,
  createBlockElementFromDom,
  getBlockTextLength,
  getBlockElement,
  getBlockPlainText,
  getUniqueBlockElements,
} from './editor/blocks'
export {
  getCurrentSelectionScope,
  getCurrentSelectionText,
} from './editor/selection'
export {
  buildPreview,
  clearSearchDecorations,
  isMatchVisible,
  scrollMatchIntoView,
  syncSearchDecorations,
} from './editor/decorations'
export {
  applyReplacementsToClone,
  isRangeReplaceable,
} from './editor/replacement'
