import type { Plugin } from 'siyuan'
import { showMessage } from 'siyuan'
import {
  clearSearchDecorations,
  collectSearchableBlocks,
  getCurrentSelectionText,
  scrollMatchIntoView,
  syncSearchDecorations,
} from './editor'
import {
  applyPreparedBlockReplacement,
  groupMatchesByBlock,
  prepareBlockReplacement,
} from './store-replace'
import {
  normalizePanelPosition,
  searchReplaceState,
  type PanelPosition,
} from './store-state'
import {
  createEditorContextTracker,
  resolveLiveRefreshTarget,
} from './store-context'
import {
  loadPersistedUiState,
  savePersistedUiState,
} from './store-ui-state'
import {
  debugLog,
  setDebugLoggingEnabled,
} from './debug'
import { findMatches } from './search-engine'
import {
  type PluginSettings,
} from '@/settings'
import type {
  EditorContext,
  SearchOptions,
} from './types'

let refreshTimer = 0
let persistTimer = 0
let pluginInstance: Plugin | null = null
let liveRefreshObserver: MutationObserver | null = null
let liveRefreshTarget: HTMLElement | null = null
let documentListenersBound = false

const contextTracker = createEditorContextTracker()

export { searchReplaceState }

export function bindPlugin(plugin: Plugin) {
  pluginInstance = plugin

  if (documentListenersBound) {
    return
  }

  document.addEventListener('selectionchange', handleDocumentSelectionChange)
  document.addEventListener('focusin', handleDocumentFocusIn, true)
  document.addEventListener('input', handleDocumentInput, true)
  documentListenersBound = true
  contextTracker.rememberActive()
}

export function unbindPlugin() {
  if (!documentListenersBound) {
    pluginInstance = null
    return
  }

  document.removeEventListener('selectionchange', handleDocumentSelectionChange)
  document.removeEventListener('focusin', handleDocumentFocusIn, true)
  document.removeEventListener('input', handleDocumentInput, true)
  documentListenersBound = false
  contextTracker.clear()
  pluginInstance = null
}

export async function initializeUiState() {
  const data = await loadPersistedUiState(pluginInstance)
  if (!data) {
    return
  }

  searchReplaceState.panelPosition = searchReplaceState.settings.rememberPanelPosition
    ? data.panelPosition ?? null
    : null
}

export function applyPluginSettings(settings: PluginSettings) {
  searchReplaceState.settings = { ...settings }
  searchReplaceState.options.includeCodeBlock = settings.includeCodeBlock
  setDebugLoggingEnabled(settings.debugLog)
  debugLog('settings-updated', settings)

  if (!settings.rememberPanelPosition) {
    searchReplaceState.panelPosition = null
    void persistUiState()
  }
}

export function setPanelPosition(position: PanelPosition | null, persist = true) {
  searchReplaceState.panelPosition = normalizePanelPosition(position)
  if (persist && searchReplaceState.settings.rememberPanelPosition) {
    schedulePersistUiState()
  }
}

export function persistPanelPosition() {
  if (!searchReplaceState.settings.rememberPanelPosition) {
    return
  }

  schedulePersistUiState(0)
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

  contextTracker.rememberActive()

  if (typeof replaceVisible === 'boolean') {
    searchReplaceState.replaceVisible = replaceVisible
  } else {
    searchReplaceState.replaceVisible = searchReplaceState.settings.defaultReplaceVisible
  }

  if (!searchReplaceState.query) {
    const selectionText = searchReplaceState.settings.preloadSelection
      ? getCurrentSelectionText().trim()
      : ''
    if (selectionText) {
      searchReplaceState.query = selectionText
    }
  }

  scheduleRefresh(0)
}

export function closePanel() {
  searchReplaceState.visible = false
  searchReplaceState.busy = false
  searchReplaceState.error = ''
  contextTracker.clearResolved()
  disconnectLiveRefreshObserver()
  clearSearchDecorations()
}

export function setQuery(value: string) {
  searchReplaceState.query = value
  scheduleRefresh()
}

export function setReplacement(value: string) {
  searchReplaceState.replacement = value
}

export function toggleReplaceVisible() {
  searchReplaceState.replaceVisible = !searchReplaceState.replaceVisible
}

export function toggleOption(option: keyof SearchOptions) {
  searchReplaceState.options[option] = !searchReplaceState.options[option]
  scheduleRefresh(0)
}

export function onEditorContextChanged(contextHint?: EditorContext | null) {
  const rememberedHinted = contextTracker.rememberHinted(contextHint ?? null)
  const remembered = contextTracker.remember(contextHint ?? null)
  if (!rememberedHinted && !remembered) {
    contextTracker.rememberActive()
  }

  if (!searchReplaceState.visible) {
    return
  }

  debugLog('editor-context-changed')
  scheduleRefresh(80)
}

export function getCurrentMatch() {
  return searchReplaceState.matches[searchReplaceState.currentIndex] ?? null
}

export function goNext() {
  if (!searchReplaceState.matches.length) {
    return
  }

  searchReplaceState.currentIndex = (searchReplaceState.currentIndex + 1) % searchReplaceState.matches.length
  revealCurrentMatch()
}

export function goPrev() {
  if (!searchReplaceState.matches.length) {
    return
  }

  searchReplaceState.currentIndex = (searchReplaceState.currentIndex - 1 + searchReplaceState.matches.length) % searchReplaceState.matches.length
  revealCurrentMatch()
}

export function skipCurrent() {
  goNext()
}

export async function replaceCurrent() {
  const match = getCurrentMatch()
  if (!match || searchReplaceState.busy) {
    return
  }

  debugLog('replace-current:start', match)

  const context = contextTracker.resolve()
  if (!context || context.rootId !== match.rootId) {
    await refreshMatches()
    return
  }

  const preparedReplacement = prepareBlockReplacement(
    context,
    match.blockId,
    [match],
    searchReplaceState.replacement,
    { preserveCase: searchReplaceState.settings.preserveCase },
  )
  if (preparedReplacement.status === 'missing-block') {
    await refreshMatches()
    return
  }

  if (preparedReplacement.status === 'not-replaceable') {
    showMessage('当前命中跨越复杂格式，暂不支持直接替换', 4000, 'error')
    return
  }

  const nextIndex = searchReplaceState.currentIndex

  try {
    searchReplaceState.busy = true
    await applyPreparedBlockReplacement(preparedReplacement)
    await refreshMatches()
    if (searchReplaceState.matches.length > 0) {
      searchReplaceState.currentIndex = Math.min(nextIndex, searchReplaceState.matches.length - 1)
      revealCurrentMatch()
    }
    debugLog('replace-current:done', {
      blockId: match.blockId,
      nextIndex: searchReplaceState.currentIndex,
    })
    showMessage('已替换当前命中', 2000, 'info')
  } finally {
    searchReplaceState.busy = false
  }
}

export async function replaceAll() {
  if (!searchReplaceState.matches.length || searchReplaceState.busy) {
    return
  }

  debugLog('replace-all:start', {
    count: searchReplaceState.matches.length,
  })

  const confirmed = window.confirm(`确定替换当前文档内的 ${searchReplaceState.matches.length} 处命中吗？`)
  if (!confirmed) {
    return
  }

  const context = contextTracker.resolve()
  if (!context) {
    searchReplaceState.error = '未找到当前文档'
    return
  }

  const groupedMatches = groupMatchesByBlock(searchReplaceState.matches, context.rootId)
  let replacedCount = 0
  let skippedCount = 0

  try {
    searchReplaceState.busy = true

    for (const [blockId, matches] of groupedMatches) {
      const preparedReplacement = prepareBlockReplacement(
        context,
        blockId,
        matches,
        searchReplaceState.replacement,
        { preserveCase: searchReplaceState.settings.preserveCase },
      )

      if (preparedReplacement.status === 'missing-block' || preparedReplacement.status === 'not-replaceable') {
        skippedCount += preparedReplacement.matchCount
        continue
      }

      await applyPreparedBlockReplacement(preparedReplacement)
      replacedCount += preparedReplacement.appliedCount
      skippedCount += Math.max(0, preparedReplacement.matchCount - preparedReplacement.appliedCount)
    }

    await refreshMatches()
    debugLog('replace-all:done', {
      replacedCount,
      skippedCount,
    })
    showMessage(`替换完成：${replacedCount} 处，跳过 ${skippedCount} 处`, 4000, 'info')
  } finally {
    searchReplaceState.busy = false
  }
}

async function refreshMatches() {
  if (!searchReplaceState.visible) {
    return
  }

  const context = contextTracker.resolve()
  syncLiveRefreshObserver(context)
  if (!context) {
    searchReplaceState.currentRootId = ''
    searchReplaceState.currentTitle = ''
    searchReplaceState.matches = []
    searchReplaceState.currentIndex = 0
    searchReplaceState.error = '未找到当前文档'
    clearSearchDecorations()
    return
  }

  searchReplaceState.currentRootId = context.rootId
  searchReplaceState.currentTitle = context.title

  if (!searchReplaceState.query.trim()) {
    searchReplaceState.matches = []
    searchReplaceState.currentIndex = 0
    searchReplaceState.error = ''
    clearSearchDecorations(context)
    return
  }

  const blocks = collectSearchableBlocks(context, searchReplaceState.options)
  const result = findMatches(blocks, searchReplaceState.query, searchReplaceState.options)
  searchReplaceState.error = result.error
  searchReplaceState.matches = result.matches
  debugLog('refresh-matches', {
    error: result.error,
    matchCount: result.matches.length,
    query: searchReplaceState.query,
    rootId: context.rootId,
  })

  if (!searchReplaceState.matches.length) {
    searchReplaceState.currentIndex = 0
    clearSearchDecorations(context)
    return
  }

  if (searchReplaceState.currentIndex >= searchReplaceState.matches.length) {
    searchReplaceState.currentIndex = searchReplaceState.matches.length - 1
  }

  revealCurrentMatch(context)
}

function scheduleRefresh(delay = 120) {
  window.clearTimeout(refreshTimer)
  refreshTimer = window.setTimeout(() => {
    void refreshMatches()
  }, delay)
}

function syncLiveRefreshObserver(context: EditorContext | null) {
  const nextTarget = resolveLiveRefreshTarget(context)
  if (liveRefreshTarget === nextTarget) {
    return
  }

  disconnectLiveRefreshObserver()
  if (!nextTarget || typeof MutationObserver !== 'function') {
    return
  }

  liveRefreshObserver = new MutationObserver((mutations) => {
    if (!searchReplaceState.visible || searchReplaceState.busy || !searchReplaceState.query.trim()) {
      return
    }

    const hasContentChange = mutations.some(mutation => mutation.type === 'childList' || mutation.type === 'characterData')
    if (!hasContentChange) {
      return
    }

    debugLog('editor-dom-changed')
    scheduleRefresh(80)
  })
  liveRefreshObserver.observe(nextTarget, {
    childList: true,
    characterData: true,
    subtree: true,
  })
  liveRefreshTarget = nextTarget
}

function disconnectLiveRefreshObserver() {
  liveRefreshObserver?.disconnect()
  liveRefreshObserver = null
  liveRefreshTarget = null
}

function handleDocumentSelectionChange() {
  contextTracker.rememberActive()
}

function handleDocumentFocusIn(event: FocusEvent) {
  const context = contextTracker.createContextFromTarget(event.target)
  contextTracker.rememberHinted(context)
  contextTracker.remember(context)
}

function handleDocumentInput(event: Event) {
  const context = contextTracker.createContextFromTarget(event.target)
  if (!context) {
    return
  }

  contextTracker.rememberHinted(context)
  contextTracker.remember(context)
  if (!searchReplaceState.visible || searchReplaceState.busy) {
    return
  }

  const resolvedContext = contextTracker.resolve()
  if (!resolvedContext || resolvedContext.protyle !== context.protyle) {
    return
  }

  debugLog('editor-input')
  scheduleRefresh(50)
}

function schedulePersistUiState(delay = 180) {
  if (!pluginInstance) {
    return
  }

  window.clearTimeout(persistTimer)
  persistTimer = window.setTimeout(() => {
    void persistUiState()
  }, delay)
}

async function persistUiState() {
  await savePersistedUiState(pluginInstance, searchReplaceState.panelPosition)
}

function revealCurrentMatch(context = contextTracker.resolve()) {
  if (!context) {
    clearSearchDecorations()
    return
  }

  const currentMatch = getCurrentMatch()
  syncSearchDecorations(context, searchReplaceState.matches, currentMatch)
  scrollMatchIntoView(context, currentMatch)
}
