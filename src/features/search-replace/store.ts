import type { Plugin } from 'siyuan'
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
import type {
  EditorContext,
  SearchOptions,
} from './types'
import { debugLog, setDebugLoggingEnabled } from './debug'
import type { PluginSettings } from '@/settings'
import {
  clearSelectionScope,
  clearCachedEditorState,
  rememberEditorContext,
  rememberHintedEditorContext,
  rememberSelectionScope,
} from './store/context-cache'
import { invalidateDocumentSnapshot } from './store/document-snapshot'
import { replaceAllMatches, replaceCurrentMatch } from './store/replacement'
import { createSearchController } from './store/search-controller'
import {
  type PanelPosition,
  searchReplaceState,
} from './store/state'
import {
  bindUiStatePlugin,
  loadStoredPanelPosition,
  normalizePanelPosition,
  persistUiState,
  schedulePersistUiState,
  unbindUiStatePlugin,
} from './store/ui-state'

export { searchReplaceState } from './store/state'
const searchController = createSearchController({
  getCurrentMatch: () => getCurrentMatch(),
  state: searchReplaceState,
})

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
  const storedPanelPosition = await loadStoredPanelPosition()
  if (storedPanelPosition === undefined && searchReplaceState.settings.rememberPanelPosition) {
    return
  }

  searchReplaceState.panelPosition = searchReplaceState.settings.rememberPanelPosition
    ? storedPanelPosition ?? null
    : null
}

export function applyPluginSettings(settings: PluginSettings) {
  searchReplaceState.settings = { ...settings }
  searchReplaceState.minimapVisible = settings.minimapVisible
  searchReplaceState.options.includeCodeBlock = settings.includeCodeBlock
  searchReplaceState.options.searchAttributeView = settings.searchAttributeView
  setDebugLoggingEnabled(settings.debugLog)
  debugLog('settings-updated', settings)

  if (!settings.rememberPanelPosition) {
    searchReplaceState.panelPosition = null
    void persistUiState(null)
  }
}

export function setPanelPosition(position: PanelPosition | null, persist = true) {
  searchReplaceState.panelPosition = normalizePanelPosition(position)
  if (persist && searchReplaceState.settings.rememberPanelPosition) {
    schedulePersistUiState(searchReplaceState.panelPosition)
  }
}

export function persistPanelPosition() {
  if (!searchReplaceState.settings.rememberPanelPosition) {
    return
  }

  schedulePersistUiState(searchReplaceState.panelPosition, 0)
}

export function resetStoredPanelPosition() {
  setPanelPosition(null)
}

export function openPanel(forceVisible?: boolean, replaceVisible?: boolean) {
  searchReplaceState.visible = forceVisible ?? !searchReplaceState.visible
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

  if (typeof replaceVisible === 'boolean') {
    searchReplaceState.replaceVisible = replaceVisible
  } else {
    searchReplaceState.replaceVisible = searchReplaceState.settings.defaultReplaceVisible
  }

  const selectionText = searchReplaceState.settings.preloadSelection
    ? getCurrentSelectionText().trim()
    : ''

  if (selectionText) {
    searchReplaceState.query = selectionText
  }

  searchController.scheduleRefresh(0)
}

export function closePanel() {
  searchReplaceState.visible = false
  searchReplaceState.busy = false
  searchReplaceState.error = ''
  searchReplaceState.navigationHint = ''
  searchReplaceState.minimapBlocks = []
  searchReplaceState.searchableBlockCount = 0
  clearCachedEditorState()
  searchController.resetSearchSession()
}

export function setQuery(value: string) {
  searchReplaceState.query = value
  searchController.handleQueryEdited()
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
  searchReplaceState.options[option] = !searchReplaceState.options[option]
  if (option === 'selectionOnly' && !searchReplaceState.options.selectionOnly) {
    clearSelectionScope()
  }
  searchController.scheduleRefresh(0)
}

export function onEditorContextChanged(contextHint?: EditorContext | null) {
  searchController.onEditorContextChanged(contextHint)
}

export function getCurrentMatch() {
  return searchReplaceState.matches[searchReplaceState.currentIndex] ?? null
}

export function goNext() {
  if (!searchReplaceState.matches.length) {
    return
  }

  searchReplaceState.currentIndex = (searchReplaceState.currentIndex + 1) % searchReplaceState.matches.length
  searchController.revealCurrentMatch(undefined, 'if-needed')
}

export function goPrev() {
  if (!searchReplaceState.matches.length) {
    return
  }

  searchReplaceState.currentIndex = (searchReplaceState.currentIndex - 1 + searchReplaceState.matches.length) % searchReplaceState.matches.length
  searchController.revealCurrentMatch(undefined, 'if-needed')
}

export function skipCurrent() {
  goNext()
}

export async function replaceCurrent() {
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
