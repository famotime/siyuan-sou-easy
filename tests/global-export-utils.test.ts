// @vitest-environment node

import type { DocAggregateNode } from '@/features/search-replace/global/types'
import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  exportAsBlockRefs,
  exportAsEmbedQuery,
  exportAsMarkdownLinks,
} from '@/features/search-replace/global/export-utils'

describe('export-utils', () => {
  const sampleDocs: DocAggregateNode[] = [
    {
      rootId: 'root-1',
      boxId: 'box-1',
      hpath: '/技术/Vue3',
      docTitle: 'Vue3实战',
      updated: '',
      created: '',
      collapsed: false,
      totalCount: 1,
      matches: [
        {
          matchId: 'm1',
          blockId: 'block-101',
          rootId: 'root-1',
          blockType: 'p',
          matchedText: '响应式',
          prefixText: 'Vue3 的核心是',
          suffixText: '机制',
          previewText: 'Vue3 的核心是响应式机制',
          segments: [],
          fullContent: 'Vue3 的核心是响应式机制',
          sort: 0,
          updated: '',
          created: '',
          hpath: '',
          box: '',
          selectedForReplace: true,
          startOffset: 0,
          endOffset: 0,
        },
      ],
    },
  ]

  it('exports block matches with group heading and truncated preview without keyword prefix', () => {
    const md = exportAsMarkdownLinks(sampleDocs, '响应式')
    expect(md).toBe([
      '## 搜索结果：响应式',
      '',
      '### Vue3实战',
      '- [Vue3 的核心是响应式机制](siyuan://blocks/block-101)',
    ].join('\n'))

    const refs = exportAsBlockRefs(sampleDocs, '响应式')
    expect(refs).toBe([
      '## 搜索结果：响应式',
      '',
      '### Vue3实战',
      "- ((block-101 'Vue3 的核心是响应式机制'))",
    ].join('\n'))
  })

  it('exports doc-only matches as flat list of document title links/refs without group headings', () => {
    const docOnlyResults: DocAggregateNode[] = [
      {
        rootId: 'doc-1',
        boxId: 'box-1',
        hpath: '/Builder 的美好时代 20261025',
        docTitle: 'Builder 的美好时代 20261025',
        updated: '',
        created: '',
        collapsed: false,
        totalCount: 1,
        matches: [
          {
            ...sampleDocs[0].matches[0],
            matchId: 'm-doc-1',
            blockId: 'doc-1',
            rootId: 'doc-1',
            blockType: 'd',
            matchedText: '美好时代',
            previewText: 'Builder 的美好时代 20261025',
            fullContent: 'Builder 的美好时代 20261025',
          },
        ],
      },
      {
        rootId: 'doc-2',
        boxId: 'box-1',
        hpath: '/Builder 的美好时代 20261008',
        docTitle: 'Builder 的美好时代 20261008',
        updated: '',
        created: '',
        collapsed: false,
        totalCount: 1,
        matches: [
          {
            ...sampleDocs[0].matches[0],
            matchId: 'm-doc-2',
            blockId: 'doc-2',
            rootId: 'doc-2',
            blockType: 'd',
            matchedText: '美好时代',
            previewText: 'Builder 的美好时代 20261008',
            fullContent: 'Builder 的美好时代 20261008',
          },
        ],
      },
    ]

    const refs = exportAsBlockRefs(docOnlyResults, '美好时代')
    expect(refs).toBe([
      '## 搜索结果：美好时代',
      '',
      "- ((doc-1 'Builder 的美好时代 20261025'))",
      "- ((doc-2 'Builder 的美好时代 20261008'))",
    ].join('\n'))

    const md = exportAsMarkdownLinks(docOnlyResults, '美好时代')
    expect(md).toBe([
      '## 搜索结果：美好时代',
      '',
      '- [Builder 的美好时代 20261025](siyuan://blocks/doc-1)',
      '- [Builder 的美好时代 20261008](siyuan://blocks/doc-2)',
    ].join('\n'))
  })

  it('truncates long block previews and sanitizes quotes/brackets/newlines', () => {
    const longDocs: DocAggregateNode[] = [
      {
        ...sampleDocs[0],
        docTitle: "Doc [1] 'Test'",
        matches: [
          {
            ...sampleDocs[0].matches[0],
            blockId: 'block-long',
            blockType: 'p',
            previewText: "这是一段包含 [方括号] 和 '单引号' 以及\n换行符并且长度显著超过三十六个字符限制的超级长正文内容",
          },
        ],
      },
    ]

    const refs = exportAsBlockRefs(longDocs)
    expect(refs).toContain('- ((block-long \'这是一段包含 [方括号] 和 "单引号" 以及 换行符并且长度显著超过三...\'))')

    const md = exportAsMarkdownLinks(longDocs)
    expect(md).toContain('### Doc [1] \'Test\'')
    expect(md).toContain("- [这是一段包含 \\[方括号\\] 和 '单引号' 以及 换行符并且长度显著超过三...](siyuan://blocks/block-long)")
  })

  it('supports mixed doc-only and block-level documents with clean blank-line separation', () => {
    const mixedDocs: DocAggregateNode[] = [
      {
        ...sampleDocs[0],
        rootId: 'doc-only-1',
        docTitle: '纯文档条目',
        matches: [
          {
            ...sampleDocs[0].matches[0],
            blockId: 'doc-only-1',
            rootId: 'doc-only-1',
            blockType: 'd',
            previewText: '纯文档条目',
          },
        ],
      },
      sampleDocs[0],
    ]

    const refs = exportAsBlockRefs(mixedDocs, '混排')
    expect(refs).toBe([
      '## 搜索结果：混排',
      '',
      "- ((doc-only-1 '纯文档条目'))",
      '',
      '### Vue3实战',
      "- ((block-101 'Vue3 的核心是响应式机制'))",
    ].join('\n'))
  })

  it('returns empty string when no exportable matches exist', () => {
    expect(exportAsBlockRefs([], '关键词')).toBe('')
    expect(exportAsMarkdownLinks([], '关键词')).toBe('')
  })

  it('exports as siyuan embed query syntax', () => {
    const embed = exportAsEmbedQuery(sampleDocs)
    expect(embed).toContain("{{select * from blocks where id in ('block-101')}}")
  })
})
