import { searchReplaceState } from '@/features/search-replace/store'
import {
  createSearchOptionsFromSettings,
  DEFAULT_SETTINGS,
} from '@/settings'

// 「文档内搜索 store」测试共享的状态重置（RF-103 收敛自 12 个测试文件各自手写的 resetState）。
// 取各文件实现的字段超集：重置到与 store 工厂一致的默认值，等价于全新状态。
export function resetState() {
  searchReplaceState.visible = false
  searchReplaceState.replaceVisible = DEFAULT_SETTINGS.defaultReplaceVisible
  ;(searchReplaceState as any).minimapVisible = false
  ;(searchReplaceState as any).preserveCase = false
  searchReplaceState.panelPosition = null
  searchReplaceState.panelWidth = null
  searchReplaceState.query = ''
  searchReplaceState.replacement = ''
  searchReplaceState.options = createSearchOptionsFromSettings(DEFAULT_SETTINGS)
  searchReplaceState.currentRootId = ''
  searchReplaceState.currentTitle = ''
  searchReplaceState.documentReadonly = false
  searchReplaceState.navigationHint = ''
  searchReplaceState.minimapBlocks = []
  searchReplaceState.matches = []
  searchReplaceState.currentIndex = 0
  searchReplaceState.error = ''
  searchReplaceState.busy = false
  searchReplaceState.searchableBlockCount = 0
}
