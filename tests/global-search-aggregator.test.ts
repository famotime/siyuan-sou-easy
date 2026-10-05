import { describe, expect, it } from 'vitest'
import {
  aggregateBlocksToDocs,
  extractContextSnippet,
  extractDocTitleFromHpath,
  findMatchesInBlock,
  sortDocAggregateNodes,
} from '@/features/search-replace/global/doc-aggregator'
import type { RawBlockRecord } from '@/features/search-replace/global/types'

describe('doc-aggregator', () => {
  describe('extractDocTitleFromHpath', () => {
    it('extracts title correctly from deep hpath', () => {
      expect(extractDocTitleFromHpath('/知识库/技术沉淀/Vue3核心原理')).toBe('Vue3核心原理')
      expect(extractDocTitleFromHpath('/单文档')).toBe('单文档')
      expect(extractDocTitleFromHpath('')).toBe('未命名文档')
    })
  })

  describe('extractContextSnippet', () => {
    it('extracts short text snippet cleanly', () => {
      const fullText = '这里是前文内容。目标关键词就在这里出现！后文继续阐述。'
      const start = fullText.indexOf('目标关键词')
      const end = start + '目标关键词'.length
      const snippet = extractContextSnippet(fullText, start, end)

      expect(snippet.matchedText).toBe('目标关键词')
      expect(snippet.prefixText).toContain('这里是前文内容')
      expect(snippet.suffixText).toContain('就在这里出现')
      expect(snippet.previewText).toContain('目标关键词')
    })

    it('adds ellipsis when surrounding text exceeds bounds', () => {
      const longPrefix = 'A'.repeat(80)
      const longSuffix = 'B'.repeat(80)
      const fullText = `${longPrefix}KEYWORD${longSuffix}`
      const start = longPrefix.length
      const end = start + 'KEYWORD'.length
      const snippet = extractContextSnippet(fullText, start, end, 30)

      expect(snippet.prefixText.startsWith('...')).toBe(true)
      expect(snippet.suffixText.endsWith('...')).toBe(true)
    })
  })

  describe('findMatchesInBlock', () => {
    it('finds all occurrences in a block', () => {
      const block: RawBlockRecord = {
        id: 'block-1',
        root_id: 'doc-1',
        box: 'box-1',
        path: '/d1.sy',
        hpath: '/测试/文档1',
        content: '思源笔记是一款优秀的笔记工具，思源支持本地双链。',
        type: 'p',
        created: '20261005120000',
        updated: '20261005120000',
      }

      const matches = findMatchesInBlock(block, '思源')
      expect(matches).toHaveLength(2)
      expect(matches[0].matchedText).toBe('思源')
      expect(matches[1].matchedText).toBe('思源')
      expect(matches[0].blockId).toBe('block-1')
    })

    it('supports regex and wholeWord options', () => {
      const block: RawBlockRecord = {
        id: 'block-2',
        root_id: 'doc-1',
        box: 'box-1',
        path: '/d1.sy',
        hpath: '/测试/文档1',
        content: 'apple apples apple',
        type: 'p',
        created: '20261005120000',
        updated: '20261005120000',
      }

      const wholeWordMatches = findMatchesInBlock(block, 'apple', { wholeWord: true })
      expect(wholeWordMatches).toHaveLength(2)

      const regexMatches = findMatchesInBlock(block, 'apple[s]?', { useRegex: true })
      expect(regexMatches).toHaveLength(3)
    })
  })

  describe('aggregateBlocksToDocs', () => {
    it('groups multiple blocks by root_id and uses root block title if available', () => {
      const blocks: RawBlockRecord[] = [
        {
          id: 'doc-1',
          root_id: 'doc-1',
          box: 'box-1',
          path: '/d1.sy',
          hpath: '/我的项目/项目规划',
          content: '项目规划',
          type: 'd',
          created: '20261005100000',
          updated: '20261005100000',
        },
        {
          id: 'b-1',
          root_id: 'doc-1',
          box: 'box-1',
          path: '/d1.sy',
          hpath: '/我的项目/项目规划',
          content: '第一阶段核心任务包含全库搜索。',
          type: 'h',
          created: '20261005100000',
          updated: '20261005110000',
          sort: 1,
        },
        {
          id: 'b-2',
          root_id: 'doc-1',
          box: 'box-1',
          path: '/d1.sy',
          hpath: '/我的项目/项目规划',
          content: '第二阶段实现全库安全替换。',
          type: 'p',
          created: '20261005100000',
          updated: '20261005120000',
          sort: 2,
        },
        {
          id: 'b-3',
          root_id: 'doc-2',
          box: 'box-2',
          path: '/d2.sy',
          hpath: '/随笔/未命名随笔',
          content: '随笔中也提到了全库。',
          type: 'p',
          created: '20261005130000',
          updated: '20261005130000',
          sort: 1,
        },
      ]

      const docs = aggregateBlocksToDocs(blocks, '全库')
      expect(docs).toHaveLength(2)

      const doc1 = docs.find(d => d.rootId === 'doc-1')!
      expect(doc1.docTitle).toBe('项目规划')
      expect(doc1.matches).toHaveLength(2)
      expect(doc1.totalCount).toBe(2)

      const doc2 = docs.find(d => d.rootId === 'doc-2')!
      expect(doc2.docTitle).toBe('未命名随笔')
      expect(doc2.matches).toHaveLength(1)
    })

    it('filters out non-document blocks when docOnly is true', () => {
      const blocks: RawBlockRecord[] = [
        {
          id: 'doc-1',
          root_id: 'doc-1',
          box: 'box-1',
          path: '/d1.sy',
          hpath: '/知识库/深圳绿道',
          content: '深圳绿道',
          type: 'd',
          created: '20261005100000',
          updated: '20261005100000',
        },
        {
          id: 'b-p1',
          root_id: 'doc-1',
          box: 'box-1',
          path: '/d1.sy',
          hpath: '/知识库/深圳绿道',
          content: '段落中也有深圳内容',
          type: 'p',
          created: '20261005100000',
          updated: '20261005110000',
        },
        {
          id: 'b-p2',
          root_id: 'doc-2',
          box: 'box-1',
          path: '/d2.sy',
          hpath: '/知识库/其他文章',
          content: '只有段落包含深圳',
          type: 'p',
          created: '20261005100000',
          updated: '20261005110000',
        },
      ]

      const docs = aggregateBlocksToDocs(blocks, '深圳', { docOnly: true })
      expect(docs).toHaveLength(1)
      expect(docs[0].rootId).toBe('doc-1')
      expect(docs[0].matches).toHaveLength(1)
      expect(docs[0].matches[0].blockType).toBe('d')
    })
  })

  describe('sortDocAggregateNodes', () => {
    it('sorts by relevance (title match bonus + count)', () => {
      const nodes = [
        {
          rootId: 'd1',
          boxId: 'b1',
          hpath: '/path/普通笔记',
          docTitle: '普通笔记',
          updated: '20261005100000',
          created: '20261005100000',
          matches: [],
          collapsed: false,
          totalCount: 5,
        },
        {
          rootId: 'd2',
          boxId: 'b1',
          hpath: '/path/架构设计指南',
          docTitle: '架构设计指南',
          updated: '20261005090000',
          created: '20261005090000',
          matches: [],
          collapsed: false,
          totalCount: 1,
        },
      ]

      const sorted = sortDocAggregateNodes(nodes, 'relevance', '架构')
      // d2 标题命中 "架构" 增加 50 分权重，应排在首位
      expect(sorted[0].rootId).toBe('d2')
      expect(sorted[1].rootId).toBe('d1')
    })

    it('sorts by updatedDesc', () => {
      const nodes = [
        {
          rootId: 'd1',
          boxId: 'b1',
          hpath: '/d1',
          docTitle: 'd1',
          updated: '20261005100000',
          created: '20261005100000',
          matches: [],
          collapsed: false,
          totalCount: 1,
        },
        {
          rootId: 'd2',
          boxId: 'b1',
          hpath: '/d2',
          docTitle: 'd2',
          updated: '20261005120000',
          created: '20261005090000',
          matches: [],
          collapsed: false,
          totalCount: 1,
        },
      ]

      const sorted = sortDocAggregateNodes(nodes, 'updatedDesc')
      expect(sorted[0].rootId).toBe('d2')
      expect(sorted[1].rootId).toBe('d1')
    })
  })
})
