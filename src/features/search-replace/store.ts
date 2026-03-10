import type { Plugin } from 'siyuan'
import {
  applyReplacementsToClone,
  clearSearchDecorations,
  collectSearchableBlocks,
  createEditorContextFromElement,
  findEditorContextByRootId,
  getActiveEditorContext,
  getBlockElement,
  getCurrentSelectionScope,
  getCurrentSelectionText,
  scrollMatchIntoView,
  syncSearchDecorations,
} from './editor'
import { updateDomBlock } from './kernel'
import { findMatches } from './search-engine'
import type {
  EditorContext,
  SearchOptions,
} from './types'
import { debugLog, setDebugLoggingEnabled } from './debug'
import type { PluginSettings } from '@/settings'
import {
  clearSelectionScope,
  clearCachedEditorState,
  clearResolvedEditorContext,
  rememberEditorContext,
  rememberHintedEditorContext,
  rememberSelectionScope,
  resolveEditorContext as resolveCachedEditorContext,
  resolveSelectionScope as resolveCachedSelectionScope,
} from './store/context-cache'
import { replaceAllMatches, replaceCurrentMatch } from './store/replacement'
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

let refreshTimer = 0
let selectionRevealTimer = 0
let liveRefreshObserver: MutationObserver | null = null
let liveRefreshTarget: HTMLElement | null = null
let documentListenersBound = false
const NO_SELECTION_SCOPE_ERROR = '选区模式已开启，但当前没有可用选区'

export { searchReplaceState } from './store/state'

export function bindPlugin(plugin: Plugin) {
  bindUiStatePlugin(plugin)

  if (documentListenersBound) {
    return
  }

  document.addEventListener('selectionchange', handleDocumentSelectionChange)
  document.addEventListener('focusin', handleDocumentFocusIn, true)
  document.addEventListener('input', handleDocumentInput, true)
  documentListenersBound = true
  rememberEditorContext(getActiveEditorContext())
}

export function unbindPlugin() {
  if (documentListenersBound) {
    clearSelectionRevealTimer()
    document.removeEventListener('selectionchange', handleDocumentSelectionChange)
    document.removeEventListener('focusin', handleDocumentFocusIn, true)
    document.removeEventListener('input', handleDocumentInput, true)
    documentListenersBound = false
  }

  disconnectLiveRefreshObserver()
  clearCachedEditorState()
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
  clearSelectionRevealTimer()
  clearSelectionScope()
  clearResolvedEditorContext()
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
  scheduleRefresh(0)
}

export function onEditorContextChanged(contextHint?: EditorContext | null) {
  if (
    searchReplaceState.options.selectionOnly
    && contextHint?.rootId
    && searchReplaceState.currentRootId
    && contextHint.rootId !== searchReplaceState.currentRootId
  ) {
    clearSelectionScope()
  }

  if (contextHint) {
    rememberHintedEditorContext(contextHint)
    rememberEditorContext(contextHint)
    if (searchReplaceState.options.selectionOnly) {
      const scope = getCurrentSelectionScope(contextHint)
      if (scope.size > 0) {
        rememberSelectionScope(contextHint, scope)
      } else {
        clearSelectionScope(contextHint.rootId)
      }
    }
  } else {
    rememberEditorContext(getActiveEditorContext())
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
  revealCurrentMatch(undefined, 'if-needed')
}

export function goPrev() {
  if (!searchReplaceState.matches.length) {
    return
  }

  searchReplaceState.currentIndex = (searchReplaceState.currentIndex - 1 + searchReplaceState.matches.length) % searchReplaceState.matches.length
  revealCurrentMatch(undefined, 'if-needed')
}

export function skipCurrent() {
  goNext()
}

export async function replaceCurrent() {
  await replaceCurrentMatch({
    applyReplacementsToClone,
    clearSelectionScope,
    getBlockElement,
    getCurrentMatch,
    refreshMatches,
    resolveEditorContext,
    revealCurrentMatch,
    state: searchReplaceState,
    updateDomBlock,
  })
}

export async function replaceAll() {
  await replaceAllMatches({
    applyReplacementsToClone,
    clearSelectionScope,
    getBlockElement,
    refreshMatches,
    resolveEditorContext,
    state: searchReplaceState,
    updateDomBlock,
  })
}

async function refreshMatches() {
  if (!searchReplaceState.visible) {
    return
  }

  const context = resolveEditorContext()
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
  const selectionScope = searchReplaceState.options.selectionOnly
    ? resolveSelectionScope(context)
    : new Map()
  if (searchReplaceState.options.selectionOnly && selectionScope.size === 0) {
    const validation = findMatches([], searchReplaceState.query, searchReplaceState.options)
    searchReplaceState.matches = []
    searchReplaceState.currentIndex = 0
    searchReplaceState.error = validation.error || NO_SELECTION_SCOPE_ERROR
    clearSearchDecorations(context)
    return
  }

  const result = findMatches(blocks, searchReplaceState.query, searchReplaceState.options, selectionScope)
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

  revealCurrentMatch(context, 'none')
}

function resolveEditorContext() {
  return resolveCachedEditorContext({
    findEditorContextByRootId,
    getActiveEditorContext,
  })
}

function resolveSelectionScope(context: EditorContext) {
  return resolveCachedSelectionScope(context, getCurrentSelectionScope)
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

    if (searchReplaceState.options.selectionOnly && context) {
      const liveSelectionScope = getCurrentSelectionScope(context)
      if (liveSelectionScope.size === 0) {
        clearSelectionScope(context.rootId)
      }
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

function resolveLiveRefreshTarget(context: EditorContext | null) {
  if (!(context?.protyle instanceof HTMLElement)) {
    return null
  }

  return context.protyle.querySelector<HTMLElement>('.protyle-wysiwyg') ?? context.protyle
}

function handleDocumentSelectionChange() {
  const selection = window.getSelection()
  const anchorElement = selection?.anchorNode instanceof Element
    ? selection.anchorNode
    : selection?.anchorNode?.parentElement
  const selectionContext = createEditorContextFromElement(anchorElement?.closest('.protyle'))

  if (selectionContext) {
    const selectionScope = getCurrentSelectionScope(selectionContext)
    const hasCollapsedCaret = Boolean(selection && selection.rangeCount > 0 && selection.isCollapsed)
    rememberHintedEditorContext(selectionContext)
    rememberEditorContext(selectionContext)
    if (selectionScope.size > 0) {
      rememberSelectionScope(selectionContext, selectionScope)
    }
    if (searchReplaceState.visible && searchReplaceState.options.selectionOnly) {
      if (selectionScope.size > 0) {
        scheduleRefresh(0)
        scheduleSelectionHighlightReveal(selectionContext)
      } else if (hasCollapsedCaret) {
        clearSelectionRevealTimer()
      }
    }
    return
  }

  rememberEditorContext(getActiveEditorContext())
}

function scheduleSelectionHighlightReveal(context: EditorContext) {
  clearSelectionRevealTimer()
  if (!searchReplaceState.query.trim()) {
    return
  }

  selectionRevealTimer = window.setTimeout(() => {
    if (!searchReplaceState.visible || !searchReplaceState.options.selectionOnly) {
      return
    }

    const scope = getCurrentSelectionScope(context)
    if (scope.size > 0) {
      rememberHintedEditorContext(context)
      rememberEditorContext(context)
      rememberSelectionScope(context, scope)
    }

    const selection = window.getSelection()
    if (selection?.rangeCount) {
      selection.removeAllRanges()
    }
    scheduleRefresh(0)
  }, 80)
}

function clearSelectionRevealTimer() {
  window.clearTimeout(selectionRevealTimer)
}

function handleDocumentFocusIn(event: FocusEvent) {
  const target = event.target instanceof Element ? event.target : null
  const protyle = target?.closest('.protyle')
  const context = createEditorContextFromElement(protyle instanceof HTMLElement ? protyle : null)
  rememberHintedEditorContext(context)
  rememberEditorContext(context)
}

function handleDocumentInput(event: Event) {
  const target = event.target instanceof Element ? event.target : null
  const protyle = target?.closest('.protyle')
  const context = createEditorContextFromElement(protyle instanceof HTMLElement ? protyle : null)
  if (!context) {
    return
  }

  rememberHintedEditorContext(context)
  rememberEditorContext(context)
  if (!searchReplaceState.visible || searchReplaceState.busy) {
    return
  }

  const resolvedContext = resolveEditorContext()
  if (!resolvedContext || resolvedContext.protyle !== context.protyle) {
    return
  }

  debugLog('editor-input')
  scheduleRefresh(50)
}

function revealCurrentMatch(
  context = resolveEditorContext(),
  scrollMode: 'if-needed' | 'none' = 'none',
) {
  if (!context) {
    clearSearchDecorations()
    return
  }

  const currentMatch = getCurrentMatch()
  syncSearchDecorations(context, searchReplaceState.matches, currentMatch)
  if (scrollMode === 'none') {
    return
  }

  scrollMatchIntoView(context, currentMatch, scrollMode)
}
