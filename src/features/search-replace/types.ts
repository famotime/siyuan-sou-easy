export interface SearchOptions {
  matchCase: boolean
  wholeWord: boolean
  useRegex: boolean
  includeCodeBlock: boolean
}

export interface EditorContext {
  protyle: HTMLElement
  rootId: string
  title: string
}

export interface SearchableBlock {
  blockId: string
  rootId: string
  blockType: string
  blockIndex: number
  text: string
  element: HTMLElement
}

export interface SearchMatch {
  id: string
  blockId: string
  rootId: string
  blockType: string
  blockIndex: number
  start: number
  end: number
  matchedText: string
  previewText: string
  replaceable: boolean
}

export interface ReplacementOutcome {
  clone: HTMLElement | null
  appliedCount: number
}
