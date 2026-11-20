import type {
  EditorContext,
  SearchMatch,
} from '../types'
import type { SearchReplaceState } from './state'
import { t } from '@/i18n/runtime'
import { searchAttributeViewMatches } from '../attribute-view'
import {
  debugElement,
  debugLog,
  debugLogLazy,
} from '../debug'
import {
  clearSearchDecorations,
  findEditorContextByRootId,
  getActiveEditorContext,
  getCurrentSelectionScope,
  isMatchVisible,
  scrollMatchIntoView,
  syncSearchDecorations,
} from '../editor'
import { getBlockAttrs } from '../kernel'
import { findMatches } from '../search-engine'
import { createTtlCache } from '../ttl-cache'
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
import { resolveBlocksForSearch } from './search-blocks'
import { createSearchDocumentEventController } from './search-document-events'
import { createPendingNavigationController } from './search-pending-navigation'
import { clearQueryEditState } from './search-session-state'

interface SearchControllerOptions {
  getCurrentMatch: () => SearchMatch | null
  state: SearchReplaceState
}

// 只读判定结果按 rootId 缓存：refreshMatches 在每次按键防抖后都会调用，
// 不缓存则每个按键都触发一次 getBlockAttrs 内核请求。
// 失效策略：rootId 变化自然走新 key；叠加 TTL 防外部修改只读状态后长期陈旧；
// 搜索会话重置（resetSearchSession）时整体清空。
const DOCUMENT_READONLY_CACHE_TTL_MS = 10_000

export function createSearchController({
  getCurrentMatch,
  state,
}: SearchControllerOptions) {
  let refreshTimer = 0
  let latestRefreshRevision = 0
  let pendingQueryIndex: number | null = null
  const documentReadonlyCache = createTtlCache<boolean>(DOCUMENT_READONLY_CACHE_TTL_MS)

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
    documentReadonlyCache.invalidate()
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

  async function refreshMatches(
    revision = ++latestRefreshRevision,
    scrollMode: 'if-needed' | 'none' = 'none',
  ) {
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
    state.documentReadonly = await resolveDocumentReadonly(context)
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
      // 候选计算段（RF-111 抽出）：块解析、选区校验、匹配与属性视图合并，
      // 状态写回与定位留在主函数
      const outcome = await computeSearchOutcome(context, revision)
      if (outcome.kind === 'stale') {
        return
      }

      if (outcome.kind === 'no-selection-scope') {
        resetMatches(outcome.error)
        clearSearchDecorations(context)
        return
      }

      state.minimapBlocks = outcome.minimapBlocks
      state.searchableBlockCount = outcome.minimapBlocks.length
      state.error = outcome.error
      state.matches = outcome.matches
      debugLog('refresh-matches', {
        error: outcome.error,
        matchCount: outcome.matches.length,
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

      revealCurrentMatch(context, scrollMode)
    } finally {
      if (revision === latestRefreshRevision) {
        state.searching = false
      }
    }
  }

  type SearchOutcome =
    | { kind: 'stale' }
    | { kind: 'no-selection-scope', error: string }
    | {
      error: string
      kind: 'result'
      matches: SearchMatch[]
      minimapBlocks: Array<{ blockId: string, blockIndex: number, blockType: string }>
    }

  /**
   * 候选计算段（RF-111 自 refreshMatches 拆出）：
   * 解析搜索块 → 选区作用域校验 → 文本匹配 → 属性视图合并。
   * 过期（revision 失效）返回 { kind: 'stale' }，主函数直接退出、不写任何状态。
   */
  async function computeSearchOutcome(context: EditorContext, revision: number): Promise<SearchOutcome> {
    const {
      blocks,
      documentContent,
    } = await resolveBlocksForSearch(context, state.options)
    if (revision !== latestRefreshRevision) {
      return { kind: 'stale' }
    }

    const selectionScope = state.options.selectionOnly
      ? resolveSelectionScope(context)
      : new Map()
    if (state.options.selectionOnly && selectionScope.size === 0) {
      const validation = findMatches([], state.query, state.options)
      return {
        error: validation.error || t('selectionOnlyNoScope'),
        kind: 'no-selection-scope',
      }
    }

    const result = findMatches(blocks, state.query, state.options, selectionScope)
    const minimapBlocks = blocks.map((block) => ({
      blockId: block.blockId,
      blockIndex: block.blockIndex,
      blockType: block.blockType,
    }))
    let matches = result.matches
    if (!result.error && context.sourceKind !== 'canvas') {
      const attributeViewSearch = await searchAttributeViewMatches({
        context,
        documentContent,
        isStale: () => revision !== latestRefreshRevision,
        options: state.options,
        query: state.query,
        startingBlockIndex: minimapBlocks.length,
      })
      if (revision !== latestRefreshRevision) {
        return { kind: 'stale' }
      }

      minimapBlocks.push(...attributeViewSearch.blocks)
      matches = [...matches, ...attributeViewSearch.matches].sort(compareSearchMatches)
    }

    return {
      error: result.error,
      kind: 'result',
      matches,
      minimapBlocks,
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

  async function resolveDocumentReadonly(context: EditorContext) {
    if (context.sourceKind === 'canvas') {
      return Boolean(context.canvas?.readonly)
    }

    const cached = documentReadonlyCache.get(context.rootId)
    if (cached !== undefined) {
      return cached
    }

    try {
      const attrs = await getBlockAttrs(context.rootId)
      const readonly = isReadonlyBlockAttrs(attrs)
      documentReadonlyCache.set(context.rootId, readonly)
      return readonly
    } catch {
      // 查询失败不写缓存，下次刷新重试
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
      void refreshMatches(revision, 'if-needed')
    }, delay)
  }

  function clearQueryDraftState() {
    window.clearTimeout(refreshTimer)
    latestRefreshRevision += 1
    pendingQueryIndex = null
    clearQueryEditState(state)
    pendingNavigation.clearPendingNavigation()

    const context = resolveEditorContext()
    clearSearchDecorations(context)
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
    debugLogLazy('reveal-current-match:start', () => ({
      currentIndex: state.currentIndex,
      matchId: currentMatch?.id ?? null,
      rootId: context.rootId,
      scrollContainer: debugElement(scrollContainer),
      scrollMode,
      totalMatches: state.matches.length,
    }))
    syncSearchDecorations(context, state.matches, currentMatch, {
      largeCodeBlockLineThreshold: state.settings.largeCodeBlockLineThreshold,
      optimizeLargeCodeBlocks: state.settings.optimizeLargeCodeBlocks,
    })
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
    clearQueryDraftState,
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
