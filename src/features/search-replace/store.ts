import { showMessage, type Plugin } from 'siyuan'
import { t } from '@/i18n/runtime'
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
  querySql,
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
  applyClosePanelState,
  applyOpenPanelState,
  resolveNextPanelVisibility,
} from './store/search-session-state'
import {
  type PanelPosition,
  searchReplaceState,
} from './store/state'
import {
  bindUiStatePlugin,
  loadStoredPanelPosition,
  loadStoredUiState,
  normalizePanelPosition,
  normalizePanelWidth,
  persistUiState,
  schedulePersistUiState,
  unbindUiStatePlugin,
} from './store/ui-state'
import { mapTerminalSearchResult } from './terminal/adapter'
import type { TerminalSearchSurface } from './terminal/registry'

export { searchReplaceState } from './store/state'
export { normalizePanelWidth } from './store/ui-state'
const searchController = createSearchController({
  getCurrentMatch: () => getCurrentMatch(),
  state: searchReplaceState,
})
let activeTerminalSurface: TerminalSearchSurface | null = null

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
  resetTerminalMode()
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
  }

  searchController.scheduleRefresh(0)
}

export function closePanel() {
  if (searchReplaceState.sourceMode === 'terminal') {
    applyClosePanelState(searchReplaceState)
    resetTerminalMode()
    searchReplaceState.matches = []
    searchReplaceState.currentIndex = 0
    searchReplaceState.error = ''
    return
  }

  applyClosePanelState(searchReplaceState)
  clearCachedEditorState()
  searchController.resetSearchSession()
}

export function setQuery(value: string) {
  if (searchReplaceState.sourceMode === 'terminal') {
    searchReplaceState.query = value
    refreshTerminalMatches()
    return
  }

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
  if (searchReplaceState.sourceMode === 'terminal') {
    if (option === 'selectionOnly') {
      searchReplaceState.options.selectionOnly = false
      return
    }
    searchReplaceState.options[option] = !searchReplaceState.options[option]
    refreshTerminalMatches()
    return
  }

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
  if (searchReplaceState.sourceMode === 'terminal') {
    if (!searchReplaceState.matches.length) {
      return
    }
    searchReplaceState.currentIndex = (searchReplaceState.currentIndex + 1) % searchReplaceState.matches.length
    activeTerminalSurface?.goTo(searchReplaceState.currentIndex)
    return
  }

  if (!searchReplaceState.matches.length) {
    return
  }

  searchReplaceState.currentIndex = (searchReplaceState.currentIndex + 1) % searchReplaceState.matches.length
  searchController.revealCurrentMatch(undefined, 'if-needed')
}

export function goPrev() {
  if (searchReplaceState.sourceMode === 'terminal') {
    if (!searchReplaceState.matches.length) {
      return
    }
    searchReplaceState.currentIndex = (searchReplaceState.currentIndex - 1 + searchReplaceState.matches.length) % searchReplaceState.matches.length
    activeTerminalSurface?.goTo(searchReplaceState.currentIndex)
    return
  }

  if (!searchReplaceState.matches.length) {
    return
  }

  searchReplaceState.currentIndex = (searchReplaceState.currentIndex - 1 + searchReplaceState.matches.length) % searchReplaceState.matches.length
  searchController.revealCurrentMatch(undefined, 'if-needed')
}

export function jumpToMatchIndex(oneBasedIndex: number) {
  if (!searchReplaceState.matches.length) {
    return
  }

  const targetIndex = oneBasedIndex - 1
  if (targetIndex < 0 || targetIndex >= searchReplaceState.matches.length) {
    return
  }

  searchReplaceState.currentIndex = targetIndex

  if (searchReplaceState.sourceMode === 'terminal') {
    activeTerminalSurface?.goTo(searchReplaceState.currentIndex)
    return
  }

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
  activeTerminalSurface = surface
  searchReplaceState.sourceMode = 'terminal'
  searchReplaceState.terminalSurfaceId = surface.id
  searchReplaceState.currentRootId = surface.id
  searchReplaceState.currentTitle = surface.title
  searchReplaceState.documentReadonly = true
  searchReplaceState.options.selectionOnly = false
  searchReplaceState.visible = true
  searchReplaceState.replaceVisible = Boolean(replaceVisible)
  searchReplaceState.error = ''
  searchReplaceState.navigationHint = ''
  searchReplaceState.matches = []
  searchReplaceState.currentIndex = 0
  searchReplaceState.searchableBlockCount = 0
  searchReplaceState.minimapBlocks = []
  surface.focus()
  if (searchReplaceState.query.trim()) {
    refreshTerminalMatches()
  }
}

function refreshTerminalMatches() {
  if (!activeTerminalSurface || searchReplaceState.sourceMode !== 'terminal') {
    return false
  }

  const result = activeTerminalSurface.search({
    matchCase: searchReplaceState.options.matchCase,
    query: searchReplaceState.query,
    useRegex: searchReplaceState.options.useRegex,
    wholeWord: searchReplaceState.options.wholeWord,
  })
  const mapped = mapTerminalSearchResult(result, activeTerminalSurface.id)
  searchReplaceState.matches = mapped.matches
  searchReplaceState.currentIndex = mapped.matches.length ? Math.max(0, mapped.currentIndex) : 0
  searchReplaceState.error = mapped.error
  searchReplaceState.searchableBlockCount = mapped.matches.length ? 1 : 0
  searchReplaceState.minimapBlocks = []
  return true
}

function resetTerminalMode() {
  const wasTerminalMode = searchReplaceState.sourceMode === 'terminal' || Boolean(activeTerminalSurface)
  activeTerminalSurface?.clear()
  activeTerminalSurface = null
  searchReplaceState.sourceMode = 'editor'
  searchReplaceState.terminalSurfaceId = undefined
  if (wasTerminalMode) {
    searchReplaceState.documentReadonly = false
  }
}

export async function extractAll() {
  if (searchReplaceState.sourceMode === 'terminal' || !searchReplaceState.matches.length) {
    return
  }

  const uniqueBlockIds = Array.from(new Set(searchReplaceState.matches.map(m => m.blockId)))
  
  const limit = 1000
  const isLimited = uniqueBlockIds.length > limit
  const targetIds = uniqueBlockIds.slice(0, limit)
  let resultText = ''

  if (searchReplaceState.settings.extractAsBlockRef) {
    const textLimit = 30
    resultText = targetIds.map(id => {
      const match = searchReplaceState.matches.find(m => m.blockId === id)
      let anchorText = match?.previewText?.trim() || ''
      if (match?.matchedText) {
        anchorText = anchorText.replace(`[${match.matchedText}]`, match.matchedText)
      }
      if (anchorText.length > textLimit) {
        anchorText = anchorText.substring(0, textLimit) + '...'
      }
      anchorText = anchorText.replace(/"/g, "'").replace(/[\r\n]+/g, ' ') // Prevent breaking syntax
      return `* ((${id} "${anchorText}"))`
    }).join('\n')
  } else {
    try {
      // Build a SQL query to get markdown for all targeted blocks
      const idListStr = targetIds.map(id => `'${id}'`).join(',')
      const results = await querySql(`SELECT id, markdown FROM blocks WHERE id IN (${idListStr})`)
      const markdownMap = new Map<string, string>()
      for (const row of results) {
        if (row?.id && typeof row.markdown === 'string') {
          markdownMap.set(row.id, row.markdown)
        }
      }
      resultText = targetIds
        .map(id => markdownMap.get(id))
        .filter((md): md is string => typeof md === 'string')
        .join('\n\n')
    } catch (e) {
      console.error('Failed to extract plain text', e)
      showMessage(t('extractLimitWarning').replace('{0}', '0'), 3000, 'error')
      return
    }
  }

  try {
    await navigator.clipboard.writeText(resultText)
    if (isLimited) {
      showMessage(t('extractLimitWarning').replace('{0}', String(limit)), 5000, 'info')
    } else {
      showMessage(t('extractSuccess').replace('{0}', String(targetIds.length)), 3000, 'info')
    }
  } catch (e) {
    console.error('Clipboard write failed', e)
  }
}
