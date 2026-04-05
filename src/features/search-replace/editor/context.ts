import { debugElement, debugLog } from '../debug'
import type { EditorContext } from '../types'

export function getActiveEditorContext(): EditorContext | null {
  const selection = window.getSelection()
  const anchorElement = selection?.anchorNode instanceof Element
    ? selection.anchorNode
    : selection?.anchorNode?.parentElement

  const directCandidates = [
    createEditorContextFromElement(anchorElement?.closest('.protyle')),
    createEditorContextFromElement((document.activeElement as HTMLElement | null)?.closest?.('.protyle')),
  ].filter(Boolean) as EditorContext[]
  const preferredDirectCandidates = dedupeAndPreferVisibleContexts(directCandidates)

  const visibleContexts = collectVisibleEditorContexts()
  const titleMatchedContext = findContextByCurrentPageTitle(visibleContexts)

  if (preferredDirectCandidates.length > 0) {
    if (titleMatchedContext) {
      const directTitleMatch = preferredDirectCandidates.find(candidate => candidate.rootId === titleMatchedContext.rootId)
      if (directTitleMatch) {
        return directTitleMatch
      }

      return titleMatchedContext
    }

    return preferredDirectCandidates[0]
  }

  if (titleMatchedContext) {
    return titleMatchedContext
  }

  const activeWindowContext = createEditorContextFromElement(document.querySelector('.layout__wnd--active .protyle'))
  if (activeWindowContext) {
    return activeWindowContext
  }

  if (visibleContexts.length > 0) {
    return visibleContexts[0]
  }

  return null
}

export function createEditorContextFromElement(protyle: HTMLElement | null | undefined, rootIdHint = '', titleHint = ''): EditorContext | null {
  if (!(protyle instanceof HTMLElement)) {
    return null
  }

  const rootId = rootIdHint.trim() || getRootId(protyle)
  if (!rootId) {
    return null
  }

  return {
    protyle,
    rootId,
    title: titleHint.trim() || getEditorTitle(protyle),
  }
}

export function createEditorContextFromProtyleLike(protyle: {
  block?: {
    rootID?: string
  }
  element?: HTMLElement
} | null | undefined) {
  return createEditorContextFromElement(protyle?.element, protyle?.block?.rootID)
}

export function findEditorContextByRootId(rootId: string, titleHint = '') {
  const normalizedRootId = rootId.trim()
  if (!normalizedRootId) {
    return null
  }

  const visibleContexts = collectVisibleEditorContexts()
  const exactMatch = visibleContexts.find(context => context.rootId === normalizedRootId)
  if (exactMatch) {
    return exactMatch
  }

  if (titleHint.trim()) {
    return visibleContexts.find(context => context.title === titleHint.trim()) ?? null
  }

  return null
}

function getRootId(protyle: HTMLElement) {
  const background = protyle.querySelector<HTMLElement>('.protyle-background[data-node-id]')
  if (background?.dataset.nodeId) {
    return background.dataset.nodeId
  }

  const titleElement = protyle.querySelector<HTMLElement>('.protyle-title[data-node-id]')
  return titleElement?.dataset.nodeId ?? ''
}

function getEditorTitle(protyle: HTMLElement) {
  const titleInput = protyle.querySelector<HTMLInputElement | HTMLTextAreaElement>('.protyle-title__input')
  if (titleInput?.value) {
    return titleInput.value
  }

  return '当前文档'
}

function collectVisibleEditorContexts() {
  const elements = Array.from(document.querySelectorAll<HTMLElement>('.protyle'))
    .filter(element => !element.classList.contains('fn__none'))

  return dedupeAndPreferVisibleContexts(
    elements
      .map(element => createEditorContextFromElement(element))
      .filter((context): context is EditorContext => Boolean(context)),
  )
}

function findContextByCurrentPageTitle(contexts: EditorContext[]) {
  const currentPageTitle = document.title.split(' - ')[0]?.trim()
  if (!currentPageTitle) {
    return null
  }

  return contexts.find(context => context.title === currentPageTitle) ?? null
}

function dedupeAndPreferVisibleContexts(contexts: EditorContext[]) {
  const preferredContextByRootId = new Map<string, EditorContext>()

  contexts.forEach((context) => {
    const existing = preferredContextByRootId.get(context.rootId)
    if (!existing || compareContextPreference(context, existing) < 0) {
      preferredContextByRootId.set(context.rootId, context)
    }
  })

  const resolvedContexts = Array.from(preferredContextByRootId.values())
    .sort((left, right) => compareContextPreference(left, right))

  if (contexts.length > resolvedContexts.length) {
    debugLog('editor-context:deduped', {
      candidates: contexts.map(context => ({
        protyle: debugElement(context.protyle),
        rect: debugRectSummary(context.protyle),
        rootId: context.rootId,
        title: context.title,
      })),
      chosen: resolvedContexts.map(context => ({
        protyle: debugElement(context.protyle),
        rect: debugRectSummary(context.protyle),
        rootId: context.rootId,
        title: context.title,
      })),
    })
  }

  return resolvedContexts
}

function compareContextPreference(left: EditorContext, right: EditorContext) {
  const leftScore = getContextPreferenceScore(left)
  const rightScore = getContextPreferenceScore(right)

  if (leftScore.inViewport !== rightScore.inViewport) {
    return leftScore.inViewport ? -1 : 1
  }

  if (leftScore.inActiveWindow !== rightScore.inActiveWindow) {
    return leftScore.inActiveWindow ? -1 : 1
  }

  if (leftScore.distanceToViewportCenter !== rightScore.distanceToViewportCenter) {
    return leftScore.distanceToViewportCenter - rightScore.distanceToViewportCenter
  }

  return 0
}

function getContextPreferenceScore(context: EditorContext) {
  const rect = context.protyle.getBoundingClientRect()
  const hasUsableViewportRect = hasUsableRect(rect)
  const viewport = {
    bottom: window.innerHeight,
    left: 0,
    right: window.innerWidth,
    top: 0,
  }
  const inViewport = hasUsableViewportRect
    && rect.bottom > viewport.top
    && rect.top < viewport.bottom
    && rect.right > viewport.left
    && rect.left < viewport.right
  const viewportCenterY = window.innerHeight / 2
  const viewportCenterX = window.innerWidth / 2
  const rectCenterY = hasUsableViewportRect ? (rect.top + rect.bottom) / 2 : Number.POSITIVE_INFINITY
  const rectCenterX = hasUsableViewportRect ? (rect.left + rect.right) / 2 : Number.POSITIVE_INFINITY

  return {
    distanceToViewportCenter: Math.abs(rectCenterY - viewportCenterY) + Math.abs(rectCenterX - viewportCenterX),
    inActiveWindow: Boolean(context.protyle.closest('.layout__wnd--active')),
    inViewport,
  }
}

function debugRectSummary(element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  return {
    bottom: rect.bottom,
    left: rect.left,
    right: rect.right,
    top: rect.top,
  }
}

function hasUsableRect(rect: DOMRect | DOMRectReadOnly | null | undefined) {
  if (!rect) {
    return false
  }

  return Number.isFinite(rect.top)
    && Number.isFinite(rect.bottom)
    && Number.isFinite(rect.left)
    && Number.isFinite(rect.right)
    && (rect.width > 0 || rect.height > 0)
}
