import type { EditorContext } from '../types'
import {
  debugElement,
  debugLogLazy,
} from '../debug'
import {
  createViewportRect,
  hasUsableRect,
  resolveRectCenterDistance,
} from './block-selection'

export function resolveEditorScrollContainer(context: EditorContext) {
  const protyleContentCandidates = Array.from(
    context.protyle.querySelectorAll<HTMLElement>('.protyle-content'),
  )
  const chosenProtyleContent = pickPreferredScrollContainer(protyleContentCandidates)
  if (chosenProtyleContent) {
    if (protyleContentCandidates.length > 1) {
      debugLogLazy('scroll-container:resolved', () => ({
        candidates: protyleContentCandidates.map((candidate) => debugElement(candidate)),
        chosen: debugElement(chosenProtyleContent),
        rootId: context.rootId,
        selector: '.protyle-content',
      }))
    }
    return chosenProtyleContent
  }

  const wysiwygCandidates = Array.from(
    context.protyle.querySelectorAll<HTMLElement>('.protyle-wysiwyg'),
  )
  const chosenWysiwyg = pickPreferredScrollContainer(wysiwygCandidates)
  if (chosenWysiwyg) {
    if (wysiwygCandidates.length > 1) {
      debugLogLazy('scroll-container:resolved', () => ({
        candidates: wysiwygCandidates.map((candidate) => debugElement(candidate)),
        chosen: debugElement(chosenWysiwyg),
        rootId: context.rootId,
        selector: '.protyle-wysiwyg',
      }))
    }
    return chosenWysiwyg
  }

  return null
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

function pickPreferredScrollContainer(candidates: HTMLElement[]) {
  const usableCandidates = candidates.filter((candidate) => (
    candidate.isConnected
    && !candidate.closest('.fn__none, .protyle-attr')
  ))
  if (!usableCandidates.length) {
    return null
  }

  const viewport = createViewportRect()

  return usableCandidates
    .map((element) => {
      const rect = element.getBoundingClientRect()
      return {
        element,
        rect,
        intersectsViewport: hasUsableRect(rect) && rect.bottom > viewport.top && rect.top < viewport.bottom,
        scrollSpan: Math.max(
          (element.scrollHeight || 0) - (element.clientHeight || 0),
          (element.scrollWidth || 0) - (element.clientWidth || 0),
        ),
      }
    })
    .sort((left, right) => {
      if (left.intersectsViewport !== right.intersectsViewport) {
        return left.intersectsViewport ? -1 : 1
      }

      const leftDistance = resolveRectCenterDistance(left.rect, viewport)
      const rightDistance = resolveRectCenterDistance(right.rect, viewport)
      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance
      }

      if (left.scrollSpan !== right.scrollSpan) {
        return right.scrollSpan - left.scrollSpan
      }

      return 0
    })[0]
    ?.element ?? null
}
