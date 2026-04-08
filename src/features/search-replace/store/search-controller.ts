import {
  clearSearchDecorations,
  findEditorContextByRootId,
  getActiveEditorContext,
  getCurrentSelectionScope,
  isMatchVisible,
  scrollMatchIntoView,
  syncSearchDecorations,
} from '../editor'
import { searchAttributeViewMatches } from '../attribute-view-search'
import { debugElement, debugLog } from '../debug'
import { findMatches } from '../search-engine'
import type {
  EditorContext,
  SearchMatch,
} from '../types'
import { t } from '@/i18n/runtime'
import { getBlockAttrs } from '../kernel'
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
} from './document-snapshot'
import { createSearchDocumentEventController } from './search-document-events'
import { createPendingNavigationController } from './search-pending-navigation'
import { resolveBlocksForSearch } from './search-blocks'
import { clearQueryEditState } from './search-session-state'
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
  let latestRefreshRevision = 0
  let pendingQueryIndex: number | null = null

  const pendingNavigation = createPendingNavigationController({
    getCurrentMatch,
    isMatchVisible,
    resolveEditorContext,
    scrollMatchIntoView,
    state,
  })
  const documentEvents = createSearchDocumentEventController({
    clearSelectionScope,
    invalidateDocumentSnapshot,
    rememberEditorContext,
    rememberHintedEditorContext,
    rememberSelectionScope,
    resolveEditorContext,
    scheduleRefresh,
    state,
  })

  function bindDocumentListeners() {
    documentEvents.bindDocumentListeners()
  }

  function unbindDocumentListeners() {
    documentEvents.unbindDocumentListeners()
  }

  function resetSearchSession() {
    pendingNavigation.reset()
    documentEvents.reset()
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

  async function refreshMatches(revision = ++latestRefreshRevision) {
    if (revision > latestRefreshRevision) {
      latestRefreshRevision = revision
    }

    if (!state.visible) {
      state.searching = false
      return
    }

    const context = resolveEditorContext()
    documentEvents.syncLiveRefreshObserver(context)
    if (!context) {
      state.searching = false
      state.documentReadonly = false
      resetMatches(t('currentDocumentMissing'))
      clearSearchDecorations()
      return
    }

    applyResolvedContext(context)
    state.documentReadonly = await resolveDocumentReadonly(context.rootId)
    if (revision !== latestRefreshRevision) {
      return
    }

    if (!state.query.trim()) {
      state.searching = false
      resetMatches()
      clearSearchDecorations(context)
      return
    }

    state.searching = true
    try {
      const { blocks, documentContent } = await resolveBlocksForSearch(context, state.options)
      if (revision !== latestRefreshRevision) {
        return
      }

      const selectionScope = state.options.selectionOnly
        ? resolveSelectionScope(context)
        : new Map()
      if (state.options.selectionOnly && selectionScope.size === 0) {
        const validation = findMatches([], state.query, state.options)
        resetMatches(validation.error || t('selectionOnlyNoScope'))
        clearSearchDecorations(context)
        return
      }

      const result = findMatches(blocks, state.query, state.options, selectionScope)
      const minimapBlocks = blocks.map(block => ({
        blockId: block.blockId,
        blockIndex: block.blockIndex,
        blockType: block.blockType,
      }))
      let matches = result.matches
      if (!result.error) {
        const attributeViewSearch = await searchAttributeViewMatches({
          context,
          documentContent,
          options: state.options,
          query: state.query,
          startingBlockIndex: minimapBlocks.length,
        })
        if (revision !== latestRefreshRevision) {
          return
        }

        minimapBlocks.push(...attributeViewSearch.blocks)
        matches = [...matches, ...attributeViewSearch.matches].sort(compareSearchMatches)
      }

      state.minimapBlocks = minimapBlocks
      state.searchableBlockCount = minimapBlocks.length
      state.error = result.error
      state.matches = matches
      debugLog('refresh-matches', {
        error: result.error,
        matchCount: matches.length,
        query: state.query,
        rootId: context.rootId,
      })

      if (!state.matches.length) {
        pendingNavigation.clearPendingNavigation()
        state.currentIndex = 0
        pendingQueryIndex = null
        clearSearchDecorations(context)
        return
      }

      if (typeof pendingQueryIndex === 'number') {
        state.currentIndex = Math.min(Math.max(0, pendingQueryIndex), state.matches.length - 1)
        pendingQueryIndex = null
      } else if (state.currentIndex >= state.matches.length) {
        state.currentIndex = state.matches.length - 1
      }

      revealCurrentMatch(context, 'none')
    } finally {
      if (revision === latestRefreshRevision) {
        state.searching = false
      }
    }
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

  async function resolveDocumentReadonly(rootId: string) {
    try {
      const attrs = await getBlockAttrs(rootId)
      return isReadonlyBlockAttrs(attrs)
    } catch {
      return false
    }
  }

  function scheduleRefresh(delay = 120) {
    window.clearTimeout(refreshTimer)
    const revision = ++latestRefreshRevision
    refreshTimer = window.setTimeout(() => {
      void refreshMatches(revision)
    }, delay)
  }

  function handleQueryEdited(delay = 50) {
    window.clearTimeout(refreshTimer)
    latestRefreshRevision += 1
    pendingQueryIndex = clearQueryEditState(state)
    pendingNavigation.clearPendingNavigation()

    const context = resolveEditorContext()
    clearSearchDecorations(context)

    if (!state.visible || pendingQueryIndex === null) {
      return
    }

    const revision = latestRefreshRevision
    refreshTimer = window.setTimeout(() => {
      void refreshMatches(revision)
    }, delay)
  }

  function revealCurrentMatch(
    context = resolveEditorContext(),
    scrollMode: 'if-needed' | 'none' = 'none',
  ) {
    if (!context) {
      pendingNavigation.clearPendingNavigation()
      clearSearchDecorations()
      return
    }

    const currentMatch = getCurrentMatch()
    const scrollContainer = context.protyle instanceof Element
      ? context.protyle.querySelector('.protyle-content')
      : null
    debugLog('reveal-current-match:start', {
      currentIndex: state.currentIndex,
      matchId: currentMatch?.id ?? null,
      rootId: context.rootId,
      scrollContainer: debugElement(scrollContainer),
      scrollMode,
      totalMatches: state.matches.length,
    })
    syncSearchDecorations(context, state.matches, currentMatch)
    if (!currentMatch) {
      pendingNavigation.clearPendingNavigation()
      return
    }

    if (scrollMode === 'none') {
      debugLog('reveal-current-match:retry-pending', {
        currentIndex: state.currentIndex,
        matchId: currentMatch.id,
      })
      pendingNavigation.retryPendingNavigationForMatch(currentMatch.id)
      return
    }

    const scrollResult = scrollMatchIntoView(context, currentMatch, scrollMode)
    const visible = scrollResult !== 'missing' && isMatchVisible(context, currentMatch)
    debugLog('reveal-current-match:scroll-result', {
      currentIndex: state.currentIndex,
      matchId: currentMatch.id,
      scrollResult,
      visible,
    })
    if (scrollResult === 'missing' || !visible) {
      pendingNavigation.beginPendingNavigation(currentMatch)
      pendingNavigation.retryPendingNavigation()
      return
    }

    pendingNavigation.clearPendingNavigation()
  }

  return {
    bindDocumentListeners,
    onEditorContextChanged,
    refreshMatches,
    resetSearchSession,
    revealCurrentMatch,
    resolveEditorContext,
    handleQueryEdited,
    scheduleRefresh,
    unbindDocumentListeners,
  }

  function applyResolvedContext(context: EditorContext) {
    state.currentRootId = context.rootId
    state.currentTitle = context.title
  }

  function resetMatches(error = '') {
    pendingNavigation.clearPendingNavigation()
    pendingQueryIndex = null
    state.searching = false
    state.minimapBlocks = []
    state.searchableBlockCount = 0
    state.matches = []
    state.currentIndex = 0
    state.error = error
  }
}

function isReadonlyBlockAttrs(attrs: Record<string, string> | null | undefined) {
  const readonlyValue = attrs?.['custom-sy-readonly'] ?? attrs?.['sy-readonly'] ?? ''
  return readonlyValue === 'true' || readonlyValue === '1'
}

function compareSearchMatches(left: SearchMatch, right: SearchMatch) {
  if (left.blockIndex !== right.blockIndex) {
    return left.blockIndex - right.blockIndex
  }

  const leftVisualIndex = left.attributeView?.visualIndex
  const rightVisualIndex = right.attributeView?.visualIndex
  if (
    left.blockId === right.blockId
    && typeof leftVisualIndex === 'number'
    && typeof rightVisualIndex === 'number'
    && leftVisualIndex !== rightVisualIndex
  ) {
    return leftVisualIndex - rightVisualIndex
  }

  if (left.start !== right.start) {
    return left.start - right.start
  }

  if (left.end !== right.end) {
    return left.end - right.end
  }

  return left.id.localeCompare(right.id)
}
