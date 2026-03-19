import {
  clearSearchDecorations,
  collectSearchableBlocks,
  createEditorContextFromElement,
  findEditorContextByRootId,
  getActiveEditorContext,
  getCurrentSelectionScope,
  scrollMatchIntoView,
  syncSearchDecorations,
} from '../editor'
import { debugLog } from '../debug'
import { getDocumentContent } from '../kernel'
import { findMatches } from '../search-engine'
import type {
  EditorContext,
  SearchMatch,
} from '../types'
import { t } from '@/i18n/runtime'
import {
  clearSelectionScope,
  rememberEditorContext,
  rememberHintedEditorContext,
  rememberSelectionScope,
  resolveEditorContext as resolveCachedEditorContext,
  resolveSelectionScope as resolveCachedSelectionScope,
} from './context-cache'
import {
  clearDocumentSnapshotCache,
  invalidateDocumentSnapshot,
  resolveDocumentBlocks,
} from './document-snapshot'
import type { SearchReplaceState } from './state'

interface SearchControllerOptions {
  getCurrentMatch: () => SearchMatch | null
  state: SearchReplaceState
}

export function createSearchController({
  getCurrentMatch,
  state,
}: SearchControllerOptions) {
  let refreshTimer = 0
  let selectionRevealTimer = 0
  let liveRefreshObserver: MutationObserver | null = null
  let liveRefreshTarget: HTMLElement | null = null
  let documentListenersBound = false

  function bindDocumentListeners() {
    if (documentListenersBound) {
      return
    }

    document.addEventListener('selectionchange', handleDocumentSelectionChange)
    document.addEventListener('focusin', handleDocumentFocusIn, true)
    document.addEventListener('input', handleDocumentInput, true)
    documentListenersBound = true
    rememberEditorContext(getActiveEditorContext())
  }

  function unbindDocumentListeners() {
    if (!documentListenersBound) {
      return
    }

    clearSelectionRevealTimer()
    document.removeEventListener('selectionchange', handleDocumentSelectionChange)
    document.removeEventListener('focusin', handleDocumentFocusIn, true)
    document.removeEventListener('input', handleDocumentInput, true)
    documentListenersBound = false
  }

  function resetSearchSession() {
    clearSelectionRevealTimer()
    disconnectLiveRefreshObserver()
    clearDocumentSnapshotCache()
    clearSearchDecorations()
  }

  function onEditorContextChanged(contextHint?: EditorContext | null) {
    if (
      state.options.selectionOnly
      && contextHint?.rootId
      && state.currentRootId
      && contextHint.rootId !== state.currentRootId
    ) {
      clearSelectionScope()
    }

    if (contextHint) {
      rememberHintedEditorContext(contextHint)
      rememberEditorContext(contextHint)
      if (state.options.selectionOnly) {
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

    if (!state.visible) {
      return
    }

    debugLog('editor-context-changed')
    scheduleRefresh(80)
  }

  async function refreshMatches() {
    if (!state.visible) {
      return
    }

    const context = resolveEditorContext()
    syncLiveRefreshObserver(context)
    if (!context) {
      state.currentRootId = ''
      state.currentTitle = ''
      state.matches = []
      state.currentIndex = 0
      state.error = t('currentDocumentMissing')
      clearSearchDecorations()
      return
    }

    state.currentRootId = context.rootId
    state.currentTitle = context.title

    if (!state.query.trim()) {
      state.matches = []
      state.currentIndex = 0
      state.error = ''
      clearSearchDecorations(context)
      return
    }

    const blocks = await resolveBlocksForSearch(context)
    const selectionScope = state.options.selectionOnly
      ? resolveSelectionScope(context)
      : new Map()
    if (state.options.selectionOnly && selectionScope.size === 0) {
      const validation = findMatches([], state.query, state.options)
      state.matches = []
      state.currentIndex = 0
      state.error = validation.error || t('selectionOnlyNoScope')
      clearSearchDecorations(context)
      return
    }

    const result = findMatches(blocks, state.query, state.options, selectionScope)
    state.error = result.error
    state.matches = result.matches
    debugLog('refresh-matches', {
      error: result.error,
      matchCount: result.matches.length,
      query: state.query,
      rootId: context.rootId,
    })

    if (!state.matches.length) {
      state.currentIndex = 0
      clearSearchDecorations(context)
      return
    }

    if (state.currentIndex >= state.matches.length) {
      state.currentIndex = state.matches.length - 1
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

  function revealCurrentMatch(
    context = resolveEditorContext(),
    scrollMode: 'if-needed' | 'none' = 'none',
  ) {
    if (!context) {
      clearSearchDecorations()
      return
    }

    const currentMatch = getCurrentMatch()
    syncSearchDecorations(context, state.matches, currentMatch)
    if (scrollMode === 'none') {
      return
    }

    scrollMatchIntoView(context, currentMatch, scrollMode)
  }

  return {
    bindDocumentListeners,
    onEditorContextChanged,
    refreshMatches,
    resetSearchSession,
    revealCurrentMatch,
    resolveEditorContext,
    scheduleRefresh,
    unbindDocumentListeners,
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
      if (!state.visible || state.busy || !state.query.trim()) {
        return
      }

      const hasContentChange = mutations.some(mutation => mutation.type === 'childList' || mutation.type === 'characterData')
      if (!hasContentChange) {
        return
      }

      if (state.options.selectionOnly && context) {
        const liveSelectionScope = getCurrentSelectionScope(context)
        if (liveSelectionScope.size === 0) {
          clearSelectionScope(context.rootId)
        }
      }

      if (context?.rootId) {
        invalidateDocumentSnapshot(context.rootId)
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
      if (state.visible && state.options.selectionOnly) {
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
    if (!state.query.trim()) {
      return
    }

    selectionRevealTimer = window.setTimeout(() => {
      if (!state.visible || !state.options.selectionOnly) {
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
    invalidateDocumentSnapshot(context.rootId)
    if (!state.visible || state.busy) {
      return
    }

    const resolvedContext = resolveEditorContext()
    if (!resolvedContext || resolvedContext.protyle !== context.protyle) {
      return
    }

    debugLog('editor-input')
    scheduleRefresh(50)
  }

  async function resolveBlocksForSearch(context: EditorContext) {
    const liveBlocks = collectSearchableBlocks(context, state.options)
    if (state.options.selectionOnly) {
      return liveBlocks
    }

    try {
      return await resolveDocumentBlocks({
        context,
        fetchDocumentContent: getDocumentContent,
        options: state.options,
      })
    } catch (error) {
      debugLog('document-snapshot:failed', {
        error: error instanceof Error ? error.message : String(error),
        rootId: context.rootId,
      })
      return liveBlocks
    }
  }
}
