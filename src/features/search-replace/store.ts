import { reactive } from 'vue'
import type { Plugin } from 'siyuan'
import { showMessage } from 'siyuan'
import {
  debugLog,
  setDebugLoggingEnabled,
} from './debug'
import {
  applyReplacementsToClone,
  clearSearchDecorations,
  collectSearchableBlocks,
  createEditorContextFromElement,
  findEditorContextByRootId,
  getActiveEditorContext,
  getBlockElement,
  getCurrentSelectionText,
  scrollMatchIntoView,
  syncSearchDecorations,
} from './editor'
import { updateDomBlock } from './kernel'
import { findMatches } from './search-engine'
import {
  DEFAULT_SETTINGS,
  createSearchOptionsFromSettings,
  type PluginSettings,
} from '@/settings'
import type {
  EditorContext,
  SearchMatch,
  SearchOptions,
} from './types'

interface PanelPosition {
  left: number
  top: number
}

interface PersistedUiState {
  panelPosition?: PanelPosition | null
}

const UI_STATE_STORAGE = 'ui-state.json'

let refreshTimer = 0
let persistTimer = 0
let pluginInstance: Plugin | null = null
let lastEditorContext: EditorContext | null = null
let lastHintedEditorContext: EditorContext | null = null
let liveRefreshObserver: MutationObserver | null = null
let liveRefreshTarget: HTMLElement | null = null
let documentListenersBound = false

export const searchReplaceState = reactive({
  visible: false,
  replaceVisible: DEFAULT_SETTINGS.defaultReplaceVisible,
  panelPosition: null as PanelPosition | null,
  settings: { ...DEFAULT_SETTINGS } as PluginSettings,
  query: '',
  replacement: '',
  options: createSearchOptionsFromSettings(DEFAULT_SETTINGS) as SearchOptions,
  currentRootId: '',
  currentTitle: '',
  matches: [] as SearchMatch[],
  currentIndex: 0,
  error: '',
  busy: false,
})

export function bindPlugin(plugin: Plugin) {
  pluginInstance = plugin

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
  if (!documentListenersBound) {
    pluginInstance = null
    return
  }

  document.removeEventListener('selectionchange', handleDocumentSelectionChange)
  document.removeEventListener('focusin', handleDocumentFocusIn, true)
  document.removeEventListener('input', handleDocumentInput, true)
  documentListenersBound = false
  lastEditorContext = null
  lastHintedEditorContext = null
  pluginInstance = null
}

export async function initializeUiState() {
  if (!pluginInstance) {
    return
  }

  try {
    const data = await pluginInstance.loadData(UI_STATE_STORAGE) as PersistedUiState | null
    if (!data) {
      return
    }

    searchReplaceState.panelPosition = searchReplaceState.settings.rememberPanelPosition
      ? normalizePanelPosition(data.panelPosition)
      : null
  } catch (error) {
    console.warn('Failed to load search-replace UI state', error)
  }
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

  rememberEditorContext(getActiveEditorContext())

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
  lastEditorContext = null
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
  if (isUsableEditorContext(contextHint)) {
    rememberHintedEditorContext(contextHint)
    rememberEditorContext(contextHint)
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

  const context = getActiveEditorContext()
  if (!context || context.rootId !== match.rootId) {
    await refreshMatches()
    return
  }

  const blockElement = getBlockElement(context, match.blockId)
  if (!blockElement) {
    await refreshMatches()
    return
  }

  const outcome = applyReplacementsToClone(blockElement, [match], searchReplaceState.replacement, {
    preserveCase: searchReplaceState.settings.preserveCase,
  })
  if (!outcome.clone || outcome.appliedCount === 0) {
    showMessage('当前命中跨越复杂格式，暂不支持直接替换', 4000, 'error')
    return
  }

  const nextIndex = searchReplaceState.currentIndex

  try {
    searchReplaceState.busy = true
    await updateDomBlock(match.blockId, outcome.clone.outerHTML)
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

  const context = getActiveEditorContext()
  if (!context) {
    searchReplaceState.error = '未找到当前文档'
    return
  }

  const groupedMatches = new Map<string, SearchMatch[]>()
  searchReplaceState.matches.forEach((match) => {
    if (match.rootId !== context.rootId) {
      return
    }

    const group = groupedMatches.get(match.blockId) ?? []
    group.push(match)
    groupedMatches.set(match.blockId, group)
  })

  let replacedCount = 0
  let skippedCount = 0

  try {
    searchReplaceState.busy = true

    for (const [blockId, matches] of groupedMatches) {
      const blockElement = getBlockElement(context, blockId)
      if (!blockElement) {
        skippedCount += matches.length
        continue
      }

      const outcome = applyReplacementsToClone(blockElement, matches, searchReplaceState.replacement, {
        preserveCase: searchReplaceState.settings.preserveCase,
      })
      if (!outcome.clone || outcome.appliedCount === 0) {
        skippedCount += matches.length
        continue
      }

      await updateDomBlock(blockId, outcome.clone.outerHTML)
      replacedCount += outcome.appliedCount
      skippedCount += Math.max(0, matches.length - outcome.appliedCount)
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

function resolveEditorContext() {
  const hintedContext = resolveHintedEditorContext()
  if (hintedContext) {
    lastEditorContext = hintedContext
    return hintedContext
  }

  const activeContext = getActiveEditorContext()
  if (isUsableEditorContext(activeContext)) {
    lastEditorContext = activeContext
    return activeContext
  }

  if (isUsableEditorContext(lastEditorContext)) {
    return lastEditorContext
  }

  if (lastEditorContext?.rootId) {
    const reconnectedContext = findEditorContextByRootId(lastEditorContext.rootId, lastEditorContext.title)
    if (isUsableEditorContext(reconnectedContext)) {
      lastEditorContext = reconnectedContext
      return reconnectedContext
    }
  }

  lastEditorContext = null
  return null
}

function resolveHintedEditorContext() {
  if (isUsableEditorContext(lastHintedEditorContext)) {
    return lastHintedEditorContext
  }

  if (lastHintedEditorContext?.rootId) {
    const reconnectedContext = findEditorContextByRootId(lastHintedEditorContext.rootId, lastHintedEditorContext.title)
    if (isUsableEditorContext(reconnectedContext)) {
      lastHintedEditorContext = reconnectedContext
      return reconnectedContext
    }
  }

  lastHintedEditorContext = null
  return null
}

function rememberEditorContext(context: EditorContext | null) {
  if (!isUsableEditorContext(context)) {
    return
  }

  lastEditorContext = context
}

function rememberHintedEditorContext(context: EditorContext | null) {
  if (!isUsableEditorContext(context)) {
    return
  }

  lastHintedEditorContext = context
}

function isUsableEditorContext(context: EditorContext | null | undefined): context is EditorContext {
  if (!context?.rootId || !context.protyle) {
    return false
  }

  return !('isConnected' in context.protyle) || context.protyle.isConnected
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

function resolveLiveRefreshTarget(context: EditorContext | null) {
  if (!(context?.protyle instanceof HTMLElement)) {
    return null
  }

  return context.protyle.querySelector<HTMLElement>('.protyle-wysiwyg') ?? context.protyle
}

function handleDocumentSelectionChange() {
  rememberEditorContext(getActiveEditorContext())
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
  if (!pluginInstance) {
    return
  }

  const payload: PersistedUiState = {
    panelPosition: normalizePanelPosition(searchReplaceState.panelPosition),
  }

  try {
    await pluginInstance.saveData(UI_STATE_STORAGE, payload)
  } catch (error) {
    console.warn('Failed to save search-replace UI state', error)
  }
}

function normalizePanelPosition(position: PanelPosition | null | undefined) {
  if (!position) {
    return null
  }

  if (!Number.isFinite(position.left) || !Number.isFinite(position.top)) {
    return null
  }

  return {
    left: position.left,
    top: position.top,
  }
}

function revealCurrentMatch(context = resolveEditorContext()) {
  if (!context) {
    clearSearchDecorations()
    return
  }

  const currentMatch = getCurrentMatch()
  syncSearchDecorations(context, searchReplaceState.matches, currentMatch)
  scrollMatchIntoView(context, currentMatch)
}
