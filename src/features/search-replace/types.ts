export interface TextOffsetRange {
  start: number
  end: number
}

export type SelectionScope = Map<string, TextOffsetRange[]>

export interface SearchOptions {
  matchCase: boolean
  wholeWord: boolean
  useRegex: boolean
  includeCodeBlock: boolean
  selectionOnly: boolean
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

export interface SearchableBlockSummary {
  blockId: string
  blockIndex: number
  blockType: string
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

export type ScrollMatchResult = 'idle' | 'missing' | 'scrolled' | 'visible'

export interface ReplacementOutcome {
  clone: HTMLElement | null
  appliedCount: number
}

export interface DocumentContentSnapshot {
  blockCount: number
  content: string
  eof: boolean
}
