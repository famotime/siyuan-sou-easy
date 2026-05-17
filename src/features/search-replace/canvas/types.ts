export type CanvasSearchTargetField = 'label' | 'note' | 'text'
export type CanvasSearchTargetType = 'edge' | 'node'

export interface CanvasSearchTarget {
  field: CanvasSearchTargetField
  id: string
  nodeId: string
  replaceable: boolean
  text: string
  title: string
  type: CanvasSearchTargetType
}

export interface CanvasSearchDecoration {
  current: boolean
  end: number
  start: number
  targetId: string
}

export interface CanvasSearchHostSnapshot {
  revision: string
  targets: CanvasSearchTarget[]
}

export interface CanvasSearchHostContext {
  filePath: string
  id: string
  readonly: boolean
  title: string
}

export interface CanvasSearchHost {
  getContext: () => CanvasSearchHostContext
  getSnapshot: () => Promise<CanvasSearchHostSnapshot>
  replaceTextRanges: (
    targetId: string,
    ranges: Array<{ end: number, start: number, text: string }>,
  ) => Promise<{ appliedCount: number, revision: string }>
  reveal: (targetId: string, range?: { end: number, start: number }) => Promise<boolean>
  root: HTMLElement
  subscribe: (listener: () => void) => () => void
  syncDecorations: (decorations: CanvasSearchDecoration[]) => void
  version: 1
}
