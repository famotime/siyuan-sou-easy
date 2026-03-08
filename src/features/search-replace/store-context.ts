import {
  createEditorContextFromElement,
  findEditorContextByRootId,
  getActiveEditorContext,
} from './editor'
import type { EditorContext } from './types'

export function createEditorContextTracker() {
  let lastEditorContext: EditorContext | null = null
  let lastHintedEditorContext: EditorContext | null = null

  function clear() {
    lastEditorContext = null
    lastHintedEditorContext = null
  }

  function clearResolved() {
    lastEditorContext = null
  }

  function remember(context: EditorContext | null) {
    if (!isUsableEditorContext(context)) {
      return false
    }

    lastEditorContext = context
    return true
  }

  function rememberHinted(context: EditorContext | null) {
    if (!isUsableEditorContext(context)) {
      return false
    }

    lastHintedEditorContext = context
    return true
  }

  function rememberActive() {
    remember(getActiveEditorContext())
  }

  function resolveHinted() {
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

  function resolve() {
    const hintedContext = resolveHinted()
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

  function createContextFromTarget(target: EventTarget | null) {
    const element = target instanceof Element ? target : null
    const protyle = element?.closest('.protyle')
    return createEditorContextFromElement(protyle instanceof HTMLElement ? protyle : null)
  }

  return {
    clear,
    clearResolved,
    createContextFromTarget,
    remember,
    rememberActive,
    rememberHinted,
    resolve,
  }
}

export function resolveLiveRefreshTarget(context: EditorContext | null) {
  if (!(context?.protyle instanceof HTMLElement)) {
    return null
  }

  return context.protyle.querySelector<HTMLElement>('.protyle-wysiwyg') ?? context.protyle
}

function isUsableEditorContext(context: EditorContext | null | undefined): context is EditorContext {
  if (!context?.rootId || !context.protyle) {
    return false
  }

  return !('isConnected' in context.protyle) || context.protyle.isConnected
}
