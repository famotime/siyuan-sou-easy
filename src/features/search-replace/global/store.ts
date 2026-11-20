// 全库搜索状态桶文件（RF-106 拆分后）。
// 原单体 store.ts 已按关注点拆分：
// - store/state.ts：响应式状态、工厂与 UI 级动作
// - store/navigation.ts：DOM 导航与高亮（含定时器链）
// - store/search-actions.ts：搜索执行与触发型动作
// 本文件保持原有导出路径不变，所有消费者（dock-manager、ui 视图、index.ts、测试）无需改动。

export {
  cancelGlobalHighlightTimers,
  findTargetTableRowElement,
  isBlockVisibleInActiveEditor,
  navigateToGlobalMatch,
  scrollAndHighlightBlock,
  scrollAndHighlightTableRow,
} from './store/navigation'
export {
  executeGlobalSearch,
  toggleGlobalOption,
} from './store/search-actions'
export {
  clearGlobalSearchResults,
  collapseAllDocs,
  createInitialGlobalSearchState,
  expandAllDocs,
  globalSearchRevision,
  globalSearchState,
  resetGlobalSearchState,
  setGlobalQuery,
  setGlobalSortMode,
  toggleAllDocsCollapse,
  toggleDocCollapse,
  toggleGlobalReplace,
} from './store/state'
