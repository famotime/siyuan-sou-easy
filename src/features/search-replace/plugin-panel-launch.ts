import type { IProtyle } from 'siyuan'
import {
  createEditorContextFromElement,
  createEditorContextFromProtyleLike,
} from './editor'
import {
  onEditorContextChanged,
  openPanel,
  searchReplaceState,
} from './store'

export type EditorProtyleLike = IProtyle

export function openSearchReplacePanelFromCommand(
  replaceVisible?: boolean,
  protyle?: EditorProtyleLike,
) {
  if (protyle) {
    onEditorContextChanged(createEditorContextFromProtyleLike(protyle))
  }

  toggleSearchReplacePanel(replaceVisible)
}

export function openSearchReplacePanelFromKeyboardEvent(
  event: KeyboardEvent,
  replaceVisible?: boolean,
) {
  const target = event.target instanceof Element ? event.target : null
  const protyle = target?.closest('.protyle')
  const context = createEditorContextFromElement(protyle instanceof HTMLElement ? protyle : null)
  if (context) {
    onEditorContextChanged(context)
  }

  toggleSearchReplacePanel(replaceVisible)
}

export function toggleSearchReplacePanel(replaceVisible?: boolean) {
  if (!searchReplaceState.visible) {
    openPanel(true, replaceVisible)
    return
  }

  const shouldClose = replaceVisible === searchReplaceState.replaceVisible
  openPanel(!shouldClose, replaceVisible)
}

export function isHotkeyCaptureTarget(target: Element | null, attributeName: string) {
  return Boolean(target?.closest(`[${attributeName}="true"]`))
}
