import type { Plugin } from 'siyuan'
import type { PanelPosition } from './store/state'
import type { TerminalSearchSurface } from './terminal/registry'
import type {
  EditorContext,
  SearchOptions,
} from './types'
import type { PluginSettings } from '@/settings'
import {
  debugLog,
  setDebugLoggingEnabled,
} from './debug'
import {
  applyReplacementsToClone,
  createBlockElementFromDom,
  getActiveEditorContext,
  getBlockElement,
  getCurrentSelectionScope,
  getCurrentSelectionText,
} from './editor'
import {
  getBlockDoms,
  updateDomBlock,
} from './kernel'
import {
  clearCachedEditorState,
  clearSelectionScope,
  rememberEditorContext,
  rememberHintedEditorContext,
  rememberSelectionScope,
} from './store/context-cache'
import { invalidateDocumentSnapshot } from './store/document-snapshot'
import {
  replaceAllMatches,
  replaceCurrentMatch,
} from './store/replacement'
import { createSearchController } from './store/search-controller'
import {
  applyClosePanelState,
  applyOpenPanelState,
  resolveNextPanelVisibility,
} from './store/search-session-state'
import {
  searchReplaceState,
} from './store/state'
import { createTerminalSession } from './store/terminal-session'
import {
  bindUiStatePlugin,
  loadStoredUiState,
  normalizePanelPosition,
  normalizePanelWidth,
  persistUiState,
  schedulePersistUiState,
  unbindUiStatePlugin,
} from './store/ui-state'

export { extractAll } from './store/extraction'
export {
  createInitialSearchReplaceState,
  resetSearchReplaceState,
  searchReplaceState,
} from './store/state'

const searchController = createSearchController({
  getCurrentMatch: () => getCurrentMatch(),
  state: searchReplaceState,
})

// 终端搜索会话（RF-108）：终端分支收敛后，主动作只判一次 sourceMode
const terminalSession = createTerminalSession(searchReplaceState)

export function bindPlugin(plugin: Plugin) {
  bindUiStatePlugin(plugin)
  searchController.bindDocumentListeners()
}

export function unbindPlugin() {
  searchController.unbindDocumentListeners()
  clearCachedEditorState()
  searchController.resetSearchSession()
  unbindUiStatePlugin()
}

export async function initializeUiState() {
  const storedUiState = await loadStoredUiState()
  if (!storedUiState && searchReplaceState.settings.rememberPanelPosition) {
    return
  }

  if (searchReplaceState.settings.rememberPanelPosition) {
    searchReplaceState.panelPosition = storedUiState?.panelPosition ?? null
    searchReplaceState.panelWidth = storedUiState?.panelWidth ?? null
  } else {
    searchReplaceState.panelPosition = null
    searchReplaceState.panelWidth = null
  }
}

export function applyPluginSettings(settings: PluginSettings) {
  searchReplaceState.settings = { ...settings }
  searchReplaceState.minimapVisible = settings.minimapVisible
  searchReplaceState.options.includeCodeBlock = settings.includeCodeBlock
  searchReplaceState.options.searchAttributeView = settings.searchAttributeView
  applySearchHighlightColor(settings.searchHighlightColor)
  setDebugLoggingEnabled(settings.debugLog)
  debugLog('settings-updated', settings)

  if (!settings.rememberPanelPosition) {
    searchReplaceState.panelPosition = null
    searchReplaceState.panelWidth = null
    void persistUiState(null, null)
  }
}

function applySearchHighlightColor(color: string) {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.style.setProperty('--sfsr-highlight-color', color)
}

export function setPanelPosition(position: PanelPosition | null, persist = true) {
  searchReplaceState.panelPosition = normalizePanelPosition(position)
  if (persist && searchReplaceState.settings.rememberPanelPosition) {
    schedulePersistUiState(searchReplaceState.panelPosition, searchReplaceState.panelWidth)
  }
}

export function setPanelWidth(width: number | null, persist = true) {
  searchReplaceState.panelWidth = normalizePanelWidth(width)
  if (persist && searchReplaceState.settings.rememberPanelPosition) {
    schedulePersistUiState(searchReplaceState.panelPosition, searchReplaceState.panelWidth)
  }
}

export function persistPanelPosition() {
  if (!searchReplaceState.settings.rememberPanelPosition) {
    return
  }

  schedulePersistUiState(searchReplaceState.panelPosition, searchReplaceState.panelWidth, 0)
}

export function resetStoredPanelPosition() {
  setPanelPosition(null)
}

export function openPanel(forceVisible?: boolean, replaceVisible?: boolean) {
  terminalSession.reset()
  searchReplaceState.visible = resolveNextPanelVisibility(searchReplaceState.visible, forceVisible)
  if (!searchReplaceState.visible) {
    closePanel()
    return
  }

  const activeContext = getActiveEditorContext()
  rememberEditorContext(activeContext)
  if (activeContext) {
    const scope = getCurrentSelectionScope(activeContext)
    if (scope.size > 0) {
      rememberSelectionScope(activeContext, scope)
    }
  }

  applyOpenPanelState(searchReplaceState, replaceVisible)

  const selectionText = searchReplaceState.settings.preloadSelection
    ? getCurrentSelectionText().trim()
    : ''

  if (selectionText) {
    searchReplaceState.query = selectionText
    searchReplaceState.committedQuery = selectionText
    searchController.scheduleRefresh(0)
    return
  }

  if (searchReplaceState.settings.searchOnEnter) {
    if (searchReplaceState.committedQuery && searchReplaceState.query === searchReplaceState.committedQuery) {
      searchController.scheduleRefresh(0)
    } else {
      searchController.clearQueryDraftState()
    }
    return
  }

  searchController.scheduleRefresh(0)
}

export function closePanel() {
  if (searchReplaceState.sourceMode === 'terminal') {
    applyClosePanelState(searchReplaceState)
    terminalSession.reset()
    terminalSession.clearMatches()
    return
  }

  applyClosePanelState(searchReplaceState)
  clearCachedEditorState()
  searchController.resetSearchSession()
}

export function setQuery(value: string) {
  if (searchReplaceState.sourceMode === 'terminal') {
    terminalSession.handleQueryEdit(value)
    return
  }

  searchReplaceState.query = value
  if (searchReplaceState.settings.searchOnEnter) {
    if (!value.trim()) {
      searchReplaceState.committedQuery = ''
      searchController.clearQueryDraftState()
      return
    }
    if (value !== searchReplaceState.committedQuery) {
      searchController.clearQueryDraftState()
      return
    }
  }

  searchController.handleQueryEdited()
}

export function commitQueryAndSearch(value?: string) {
  const nextQuery = typeof value === 'string' ? value : searchReplaceState.query
  searchReplaceState.query = nextQuery

  if (!nextQuery.trim()) {
    searchReplaceState.committedQuery = ''
    if (searchReplaceState.sourceMode === 'terminal') {
      terminalSession.clearMatches()
      return
    }
    searchController.clearQueryDraftState()
    return
  }

  searchReplaceState.committedQuery = nextQuery

  if (searchReplaceState.sourceMode === 'terminal') {
    terminalSession.refresh()
    return
  }

  searchController.handleQueryEdited(0)
}

export function setReplacement(value: string) {
  searchReplaceState.replacement = value
}

export function toggleReplaceVisible() {
  searchReplaceState.replaceVisible = !searchReplaceState.replaceVisible
}

export function togglePreserveCase() {
  searchReplaceState.preserveCase = !searchReplaceState.preserveCase
}

export function captureCurrentSelectionScope() {
  const context = getActiveEditorContext()
  if (!context) {
    return false
  }

  const scope = getCurrentSelectionScope(context)
  if (!scope.size) {
    return false
  }

  rememberHintedEditorContext(context)
  rememberEditorContext(context)
  rememberSelectionScope(context, scope)
  return true
}

export function toggleOption(option: keyof SearchOptions) {
  if (searchReplaceState.sourceMode === 'terminal') {
    terminalSession.toggleOption(option)
    return
  }

  searchReplaceState.options[option] = !searchReplaceState.options[option]
  if (option === 'selectionOnly' && !searchReplaceState.options.selectionOnly) {
    clearSelectionScope()
  }

  if (searchReplaceState.settings.searchOnEnter) {
    const hasCommittedQuery = Boolean(
      searchReplaceState.committedQuery
      && searchReplaceState.query === searchReplaceState.committedQuery,
    )
    if (hasCommittedQuery) {
      searchController.scheduleRefresh(0)
    }
    return
  }

  searchController.scheduleRefresh(0)
}

export function onEditorContextChanged(contextHint?: EditorContext | null) {
  searchController.onEditorContextChanged(contextHint)
}

export function getCurrentMatch() {
  return searchReplaceState.matches[searchReplaceState.currentIndex] ?? null
}

// goNext/goPrev 原为仅 ±1 之差的镜像实现（RF-108 合并）
function stepCurrent(delta: number) {
  if (searchReplaceState.sourceMode === 'terminal') {
    terminalSession.step(delta)
    return
  }

  if (!searchReplaceState.matches.length) {
    return
  }

  searchReplaceState.currentIndex = (searchReplaceState.currentIndex + delta + searchReplaceState.matches.length) % searchReplaceState.matches.length
  searchController.revealCurrentMatch(undefined, 'if-needed')
}

export function goNext() {
  stepCurrent(1)
}

export function goPrev() {
  stepCurrent(-1)
}

export function jumpToMatchIndex(oneBasedIndex: number) {
  if (!searchReplaceState.matches.length) {
    return
  }

  const targetIndex = oneBasedIndex - 1
  if (targetIndex < 0 || targetIndex >= searchReplaceState.matches.length) {
    return
  }

  if (searchReplaceState.sourceMode === 'terminal') {
    terminalSession.goTo(targetIndex)
    return
  }

  searchReplaceState.currentIndex = targetIndex
  searchController.revealCurrentMatch(undefined, 'if-needed')
}

export function skipCurrent() {
  goNext()
}

export async function replaceCurrent() {
  if (searchReplaceState.sourceMode === 'terminal') {
    return
  }

  await replaceCurrentMatch({
    applyReplacementsToClone,
    clearSelectionScope,
    createBlockElementFromDom,
    getBlockDoms,
    getBlockElement,
    getCurrentMatch,
    invalidateDocumentSnapshot,
    refreshMatches: searchController.refreshMatches,
    resolveEditorContext: searchController.resolveEditorContext,
    revealCurrentMatch: searchController.revealCurrentMatch,
    state: searchReplaceState,
    updateDomBlock,
  })
}

export async function replaceAll() {
  if (searchReplaceState.sourceMode === 'terminal') {
    return
  }

  await replaceAllMatches({
    applyReplacementsToClone,
    clearSelectionScope,
    createBlockElementFromDom,
    getBlockDoms,
    getBlockElement,
    invalidateDocumentSnapshot,
    refreshMatches: searchController.refreshMatches,
    resolveEditorContext: searchController.resolveEditorContext,
    state: searchReplaceState,
    updateDomBlock,
  })
}

export function openTerminalPanel(surface: TerminalSearchSurface, replaceVisible?: boolean) {
  terminalSession.open(surface, replaceVisible)
}
