import type { EditorContext } from '../types'

export function resolveMinimapContext({
  currentRootId,
  currentTitle,
  findEditorContextByRootId,
  getActiveEditorContext,
}: {
  currentRootId: string
  currentTitle: string
  findEditorContextByRootId: (rootId: string, title?: string) => EditorContext | null
  getActiveEditorContext: () => EditorContext | null
}) {
  if (currentRootId) {
    return findEditorContextByRootId(currentRootId, currentTitle) ?? getActiveEditorContext()
  }

  return getActiveEditorContext()
}

export function resolveMinimapScrollContainer(context: EditorContext) {
  return context.protyle.querySelector<HTMLElement>('.protyle-content')
    ?? context.protyle.querySelector<HTMLElement>('.protyle-wysiwyg')
    ?? context.protyle
}
