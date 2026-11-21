import type { EditorProtyleLike } from './editor'
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

export type { EditorProtyleLike }

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

export function shouldIgnorePanelHotkeyEvent(target: Element | null) {
  if (!target) {
    return false
  }

  // 1. 处于已知代码编辑器内部（如 Monaco Editor、CodeMirror、ACE 等），放行其内置快捷键（如 Ctrl+F 搜索代码）
  if (target.closest('.monaco-editor, .cm-editor, .cm-content, .CodeMirror, .ace_editor, [data-prevent-sou-easy]')) {
    return true
  }

  // 2. 处于 Dialog 弹窗内且不在 Protyle 编辑器内，放行弹窗自身处理
  if (target.closest('.b3-dialog') && !target.closest('.protyle')) {
    return true
  }

  // 3. 处于 Protyle 外部的独立输入控件（如第三方插件面板的输入框、文本域）
  const textInput = target.closest('input:not([type="checkbox"]):not([type="radio"]), textarea')
  if (textInput && !target.closest('.protyle') && !target.closest('#friendly-search-replace-app')) {
    return true
  }

  return false
}
