import { describe, expect, it } from 'vitest'
import {
  exportAsBlockRefs,
  exportAsEmbedQuery,
  exportAsMarkdownLinks,
} from '@/features/search-replace/global/export-utils'
import type { DocAggregateNode } from '@/features/search-replace/global/types'

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

  it('exports as markdown link list', () => {
    const md = exportAsMarkdownLinks(sampleDocs)
    expect(md).toContain('### Vue3实战')
    expect(md).toContain('[Vue3实战](siyuan://blocks/block-101)')
    expect(md).toContain('Vue3 的核心是响应式机制')
  })

  it('exports as siyuan block ref list', () => {
    const refs = exportAsBlockRefs(sampleDocs)
    expect(refs).toContain("((block-101 '响应式'))")
  })

  it('exports as siyuan embed query syntax', () => {
    const embed = exportAsEmbedQuery(sampleDocs)
    expect(embed).toContain("{{select * from blocks where id in ('block-101')}}")
  })
})
