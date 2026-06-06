import type { IProtyle } from 'siyuan'
import {
  createEditorContextFromElement,
  createEditorContextFromProtyleLike,
} from './editor'
import {
  onEditorContextChanged,
  openPanel,
  openTerminalPanel,
} from './store'
import {
  getActiveTerminalSearchSurface,
  isTerminalSearchTarget,
} from './terminal/registry'

export type EditorProtyleLike = IProtyle

export function openSearchReplacePanelFromCommand(
  replaceVisible?: boolean,
  protyle?: EditorProtyleLike,
) {
  if (protyle) {
    onEditorContextChanged(createEditorContextFromProtyleLike(protyle))
  }

  openSearchReplacePanel(replaceVisible)
}

export function openSearchReplacePanelFromKeyboardEvent(
  event: KeyboardEvent,
  replaceVisible?: boolean,
) {
  const target = event.target instanceof Element ? event.target : null
  if (isTerminalSearchTarget(target)) {
    const surface = getActiveTerminalSearchSurface()
    if (surface) {
      openTerminalPanel(surface, replaceVisible)
      return
    }
  }

  const protyle = target?.closest('.protyle')
  const context = createEditorContextFromElement(protyle instanceof HTMLElement ? protyle : null)
  if (context) {
    onEditorContextChanged(context)
  }

  openSearchReplacePanel(replaceVisible)
}

export function openSearchReplacePanel(replaceVisible?: boolean) {
  openPanel(true, replaceVisible)
}

export function isHotkeyCaptureTarget(target: Element | null, attributeName: string) {
  return Boolean(target?.closest(`[${attributeName}="true"]`))
}
