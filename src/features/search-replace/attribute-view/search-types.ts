export const ATTRIBUTE_VIEW_NODE_TYPE = 'NodeAttributeView'

export interface AttributeViewBlockSummary {
  avBlockId: string
  avID?: string
  blockIndex: number
  element: HTMLElement
  rootId: string
  viewID?: string
}

export interface AttributeViewCellCandidate {
  avBlockId: string
  avID: string
  columnName: string
  columnIndex?: number
  itemID?: string
  keyID: string
  rowID?: string
  rowLabel?: string
  text: string
  targetKind: 'cell' | 'column-header' | 'view-name'
}
