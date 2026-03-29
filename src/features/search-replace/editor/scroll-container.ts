import type { EditorContext } from '../types'

export function resolveEditorScrollContainer(context: EditorContext) {
  return context.protyle.querySelector<HTMLElement>('.protyle-content')
    ?? context.protyle.querySelector<HTMLElement>('.protyle-wysiwyg')
    ?? null
}

export function resolveVisibilityContainers(context: EditorContext, element: HTMLElement) {
  const containers: HTMLElement[] = []
  const editorContainer = resolveEditorScrollContainer(context)
  if (editorContainer) {
    containers.push(editorContainer)
  }

  let current: HTMLElement | null = element.parentElement
  while (current && current !== context.protyle) {
    if (isScrollableContainer(current) && !containers.includes(current)) {
      containers.push(current)
    }
    current = current.parentElement
  }

  return containers
}

export function scrollContainerTo(
  container: HTMLElement,
  options: ScrollToOptions,
) {
  if (typeof container.scrollTo === 'function') {
    container.scrollTo(options)
    return
  }

  if (typeof options.top === 'number') {
    container.scrollTop = options.top
  }
  if (typeof options.left === 'number') {
    container.scrollLeft = options.left
  }
}

function isScrollableContainer(element: HTMLElement) {
  const style = globalThis.getComputedStyle?.(element)
  const overflowX = style?.overflowX || element.style.overflowX || element.style.overflow || ''
  const overflowY = style?.overflowY || element.style.overflowY || element.style.overflow || ''

  return /auto|scroll|overlay|hidden/.test(`${overflowX} ${overflowY}`)
}
