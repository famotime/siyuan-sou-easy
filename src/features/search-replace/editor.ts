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
export {
  getCurrentSelectionScope,
  getCurrentSelectionText,
} from './editor/selection'
