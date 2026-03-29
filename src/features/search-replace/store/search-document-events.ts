import { createEditorContextFromElement, getActiveEditorContext, getCurrentSelectionScope } from '../editor'
import { debugLog } from '../debug'
import type {
  EditorContext,
  SelectionScope,
} from '../types'
import type { SearchReplaceState } from './state'

interface SearchDocumentEventControllerOptions {
  clearSelectionScope: (rootId?: string) => void
  invalidateDocumentSnapshot: (rootId: string) => void
  rememberEditorContext: (context: EditorContext | null) => void
  rememberHintedEditorContext: (context: EditorContext | null) => void
  rememberSelectionScope: (context: EditorContext, scope: SelectionScope) => void
  resolveEditorContext: () => EditorContext | null
  scheduleRefresh: (delay?: number) => void
  state: SearchReplaceState
}

export function createSearchDocumentEventController({
  clearSelectionScope,
  invalidateDocumentSnapshot,
  rememberEditorContext,
  rememberHintedEditorContext,
  rememberSelectionScope,
  resolveEditorContext,
  scheduleRefresh,
  state,
}: SearchDocumentEventControllerOptions) {
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
    disconnectLiveRefreshObserver()
    document.removeEventListener('selectionchange', handleDocumentSelectionChange)
    document.removeEventListener('focusin', handleDocumentFocusIn, true)
    document.removeEventListener('input', handleDocumentInput, true)
    documentListenersBound = false
  }

  function reset() {
    clearSelectionRevealTimer()
    disconnectLiveRefreshObserver()
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

  return {
    bindDocumentListeners,
    reset,
    syncLiveRefreshObserver,
    unbindDocumentListeners,
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
}
