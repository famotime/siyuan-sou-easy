export type GlobalBlockType =
  | 'p' // 段落
  | 'h' // 标题
  | 'l' // 列表
  | 'i' // 列表项
  | 'c' // 代码块
  | 'm' // 数学公式
  | 't' // 表格
  | 'b' // 引述
  | 's' // 超级块
  | 'av' // 属性视图
  | 'd' // 文档
  | 'html'
  | 'widget'
  | string

export interface RawBlockRecord {
  id: string
  parent_id?: string
  root_id: string
  box: string
  path: string
  hpath: string
  name?: string
  alias?: string
  memo?: string
  tag?: string
  content: string
  fcontent?: string
  markdown?: string
  type: GlobalBlockType
  subtype?: string
  sub_type?: string
  sort?: number
  created: string
  updated: string
}

export interface GlobalSearchFilters {
  notebookId?: string
  pathPrefix?: string
  tags?: string[]
  types?: string[]
  dateRange?: {
    start?: string // YYYYMMDDHHmmss 或 YYYY-MM-DD
    end?: string
  }
}

export type GlobalSearchSortMode =
  | 'relevance'
  | 'updatedDesc'
  | 'createdDesc'
  | 'readingOrder'

export interface ContextSnippetSegment {
  text: string
  isMatch: boolean
}

export interface GlobalMatchSnippet {
  matchId: string
  blockId: string
  rootId: string
  blockType: GlobalBlockType
  subType?: string
  matchedText: string
  prefixText: string
  suffixText: string
  previewText: string
  segments: ContextSnippetSegment[]
  fullContent: string
  sort: number
  updated: string
  created: string
  hpath: string
  box: string
  selectedForReplace: boolean
  startOffset: number
  endOffset: number
}

export interface DocAggregateNode {
  rootId: string
  boxId: string
  boxName?: string
  hpath: string
  docTitle: string
  updated: string
  created: string
  matches: GlobalMatchSnippet[]
  collapsed: boolean
  totalCount: number
}

export interface ParsedGlobalQuery {
  rawQuery: string
  textQuery: string
  notebook?: string
  path?: string
  tags: string[]
  types: string[]
  dateFilter?: string
}

export interface GlobalSearchStateModel {
  query: string
  replacement: string
  visible: boolean
  replaceVisible: boolean
  searching: boolean
  replacing: boolean
  error?: string
  statusMessage?: string
  options: {
    matchCase: boolean
    wholeWord: boolean
    useRegex: boolean
    pinyin: boolean
    fuzzy: boolean
    docOnly: boolean
  }
  filters: GlobalSearchFilters
  sortMode: GlobalSearchSortMode
  results: DocAggregateNode[]
  totalMatchCount: number
  totalDocCount: number
  selectedMatchId?: string
}
