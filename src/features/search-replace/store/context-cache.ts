import type {
  EditorContext,
  SelectionScope,
} from '../types'

interface EditorContextResolver {
  findEditorContextByRootId: (rootId: string, titleHint?: string) => EditorContext | null
  getActiveEditorContext: () => EditorContext | null
}

let lastEditorContext: EditorContext | null = null
let lastHintedEditorContext: EditorContext | null = null
let lastSelectionScope: SelectionScope = new Map()
let lastSelectionScopeRootId = ''

export function resolveEditorContext(resolver: EditorContextResolver) {
  const hintedContext = resolveHintedEditorContext(resolver)
  if (hintedContext) {
    lastEditorContext = hintedContext
    return hintedContext
  }

  const activeContext = resolver.getActiveEditorContext()
  if (isUsableEditorContext(activeContext)) {
    lastEditorContext = activeContext
    return activeContext
  }

  if (isUsableEditorContext(lastEditorContext)) {
    return lastEditorContext
  }

  if (lastEditorContext?.rootId) {
    const reconnectedContext = resolver.findEditorContextByRootId(lastEditorContext.rootId, lastEditorContext.title)
    if (isUsableEditorContext(reconnectedContext)) {
      lastEditorContext = reconnectedContext
      return reconnectedContext
    }
  }

  lastEditorContext = null
  return null
}

export function resolveSelectionScope(
  context: EditorContext,
  getCurrentSelectionScope: (context: EditorContext) => SelectionScope,
) {
  const liveSelectionScope = getCurrentSelectionScope(context)
  if (liveSelectionScope.size > 0) {
    rememberSelectionScope(context, liveSelectionScope)
    return liveSelectionScope
  }

  if (lastSelectionScopeRootId === context.rootId) {
    return cloneSelectionScope(lastSelectionScope)
  }

  return new Map()
}

export function rememberEditorContext(context: EditorContext | null) {
  if (!isUsableEditorContext(context)) {
    return
  }

  lastEditorContext = context
}

export function rememberHintedEditorContext(context: EditorContext | null) {
  if (!isUsableEditorContext(context)) {
    return
  }

  lastHintedEditorContext = context
}

export function rememberSelectionScope(context: EditorContext, scope: SelectionScope) {
  if (scope.size === 0) {
    return
  }

  lastSelectionScopeRootId = context.rootId
  lastSelectionScope = cloneSelectionScope(scope)
}

export function clearSelectionScope(rootId?: string) {
  if (rootId && lastSelectionScopeRootId && lastSelectionScopeRootId !== rootId) {
    return
  }

  lastSelectionScope = new Map()
  lastSelectionScopeRootId = ''
}

export function clearResolvedEditorContext() {
  lastEditorContext = null
}

export function clearCachedEditorState() {
  lastEditorContext = null
  lastHintedEditorContext = null
  clearSelectionScope()
}

export function isUsableEditorContext(context: EditorContext | null | undefined): context is EditorContext {
  if (!context?.rootId || !context.protyle) {
    return false
  }

  return !('isConnected' in context.protyle) || context.protyle.isConnected
}

function resolveHintedEditorContext(resolver: EditorContextResolver) {
  if (isUsableEditorContext(lastHintedEditorContext)) {
    return lastHintedEditorContext
  }

  if (lastHintedEditorContext?.rootId) {
    const reconnectedContext = resolver.findEditorContextByRootId(lastHintedEditorContext.rootId, lastHintedEditorContext.title)
    if (isUsableEditorContext(reconnectedContext)) {
      lastHintedEditorContext = reconnectedContext
      return reconnectedContext
    }
  }

  lastHintedEditorContext = null
  return null
}

function cloneSelectionScope(scope: SelectionScope): SelectionScope {
  return new Map(Array.from(scope.entries()).map(([blockId, ranges]) => {
    return [blockId, ranges.map(range => ({ ...range }))]
  }))
}
