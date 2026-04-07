import type { IProtyle } from 'siyuan'

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
  searchAttributeView: boolean
  selectionOnly: boolean
}

export interface EditorContext {
  protyle: HTMLElement
  protyleRef?: IProtyle | null
  rootId: string
  title: string
}

export interface TableCellSearchMetadata {
  cellId: string
  rowIndex: number
  columnIndex: number
  start: number
  end: number
}

export interface TableSearchMetadata {
  rowCount: number
  columnCount: number
  cells: TableCellSearchMetadata[]
}

export interface TableMatchMetadata {
  cellId: string
  rowIndex: number
  columnIndex: number
  rowCount: number
  columnCount: number
  cellStart: number
  cellEnd: number
}

export interface SearchableBlock {
  blockId: string
  rootId: string
  blockType: string
  blockIndex: number
  collapsedAncestorIds?: string[]
  text: string
  element: HTMLElement
  table?: TableSearchMetadata
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
  collapsedAncestorIds?: string[]
  start: number
  end: number
  matchedText: string
  previewText: string
  replaceable: boolean
  sourceKind?: 'block' | 'attribute-view'
  table?: TableMatchMetadata
  attributeView?: {
    avBlockId: string
    avID: string
    columnName: string
    columnIndex?: number
    itemID?: string
    keyID: string
    rowID?: string
    rowLabel?: string
    targetKind?: 'cell' | 'column-header' | 'group-title' | 'view-name'
  }
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
