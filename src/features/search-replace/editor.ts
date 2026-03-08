export {
  createEditorContextFromElement,
  createEditorContextFromProtyleLike,
  findEditorContextByRootId,
  getActiveEditorContext,
  getCurrentSelectionText,
} from './editor-context'

export {
  buildPreview,
  collectSearchableBlocks,
  getBlockElement,
  getBlockPlainText,
} from './editor-blocks'

export {
  clearSearchDecorations,
  scrollMatchIntoView,
  syncSearchDecorations,
} from './editor-decorations'

export {
  applyReplacementsToClone,
  isRangeReplaceable,
} from './editor-replace'
