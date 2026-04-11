import type { EditorContext } from './types'

export function getCurrentSelectionText() {
  return window.getSelection()?.toString() ?? ''
}

export function getActiveEditorContext(): EditorContext | null {
  const selection = window.getSelection()
  const anchorElement = selection?.anchorNode instanceof Element
    ? selection.anchorNode
    : selection?.anchorNode?.parentElement

  const directCandidates = [
    createEditorContextFromElement(anchorElement?.closest('.protyle')),
    createEditorContextFromElement((document.activeElement as HTMLElement | null)?.closest?.('.protyle')),
  ].filter(Boolean) as EditorContext[]

  const visibleContexts = collectVisibleEditorContexts()
  const titleMatchedContext = findContextByCurrentPageTitle(visibleContexts)

  if (directCandidates.length > 0) {
    if (titleMatchedContext) {
      const directTitleMatch = directCandidates.find(candidate => candidate.rootId === titleMatchedContext.rootId)
      if (directTitleMatch) {
        return directTitleMatch
      }

      return titleMatchedContext
    }

    return directCandidates[0]
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

  const contexts: EditorContext[] = []
  const seenRootIds = new Set<string>()

  elements.forEach((element) => {
    const context = createEditorContextFromElement(element)
    if (!context || seenRootIds.has(context.rootId)) {
      return
    }

    seenRootIds.add(context.rootId)
    contexts.push(context)
  })

  return contexts
}

function findContextByCurrentPageTitle(contexts: EditorContext[]) {
  const currentPageTitle = document.title.split(' - ')[0]?.trim()
  if (!currentPageTitle) {
    return null
  }

  return contexts.find(context => context.title === currentPageTitle) ?? null
}
