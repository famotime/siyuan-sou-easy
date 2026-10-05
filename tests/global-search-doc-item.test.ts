// @vitest-environment jsdom

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  createApp,
  nextTick,
} from 'vue'
import DocAggregateItem from '@/features/search-replace/global/ui/DocAggregateItem.vue'
import type { DocAggregateNode } from '@/features/search-replace/global/types'

describe('DocAggregateItem badge rendering', () => {
  let host: HTMLDivElement | null = null
  let app: ReturnType<typeof createApp> | null = null

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })

  afterEach(() => {
    app?.unmount()
    host?.remove()
    host = null
    app = null
  })

  it('renders "文档" badge for document root block instead of "块"', async () => {
    const docData: DocAggregateNode = {
      rootId: 'doc-root-1',
      boxId: 'box-1',
      hpath: '/知识库/深圳最长环湖绿道',
      docTitle: '深圳最长环湖绿道，湖光山色...',
      updated: '20261005120000',
      created: '20261005120000',
      collapsed: false,
      totalCount: 2,
      matches: [
        {
          matchId: 'doc-root-1:0:0',
          blockId: 'doc-root-1',
          rootId: 'doc-root-1',
          blockType: 'd',
          matchedText: '深圳',
          prefixText: '',
          suffixText: '最长环湖绿道...',
          previewText: '深圳最长环湖绿道...',
          segments: [
            { text: '深圳', isMatch: true },
            { text: '最长环湖绿道...', isMatch: false },
          ],
          fullContent: '深圳最长环湖绿道...',
          sort: 0,
          updated: '20261005120000',
          created: '20261005120000',
          hpath: '/知识库/深圳最长环湖绿道',
          box: 'box-1',
          selectedForReplace: true,
          startOffset: 0,
          endOffset: 2,
        },
        {
          matchId: 'p-1:4:1',
          blockId: 'p-1',
          rootId: 'doc-root-1',
          blockType: 'p',
          matchedText: '深圳',
          prefixText: '本文转载自',
          suffixText: '亲子部落',
          previewText: '本文转载自深圳亲子部落',
          segments: [
            { text: '本文转载自', isMatch: false },
            { text: '深圳', isMatch: true },
            { text: '亲子部落', isMatch: false },
          ],
          fullContent: '本文转载自深圳亲子部落',
          sort: 1,
          updated: '20261005120000',
          created: '20261005120000',
          hpath: '/知识库/深圳最长环湖绿道',
          box: 'box-1',
          selectedForReplace: true,
          startOffset: 5,
          endOffset: 7,
        },
      ],
    }

    app = createApp(DocAggregateItem, { doc: docData })
    app.mount(host!)
    await nextTick()

    const badges = host!.querySelectorAll('.sfsr-match-item__type-badge')
    expect(badges.length).toBe(2)

    // 第一个为根块，应明确显示为“文档”，而不是“块”
    expect(badges[0].textContent?.trim()).toBe('文档')
    // 第二个为段落块，显示为“段落”
    expect(badges[1].textContent?.trim()).toBe('段落')
  })

  it('renders "标题" badge for heading blocks and "块" for generic/other blocks', async () => {
    const docData: DocAggregateNode = {
      rootId: 'doc-root-2',
      boxId: 'box-1',
      hpath: '/知识库/标题与其它测试',
      docTitle: '测试文档',
      updated: '20261005120000',
      created: '20261005120000',
      collapsed: false,
      totalCount: 3,
      matches: [
        {
          matchId: 'h-1:0:0',
          blockId: 'h-1',
          rootId: 'doc-root-2',
          blockType: 'h',
          subType: 'h2',
          matchedText: '标题词',
          prefixText: '',
          suffixText: '',
          previewText: '二级标题内容',
          segments: [{ text: '标题词', isMatch: true }],
          fullContent: '二级标题内容',
          sort: 1,
          updated: '20261005120000',
          created: '20261005120000',
          hpath: '/知识库/测试',
          box: 'box-1',
          selectedForReplace: true,
          startOffset: 0,
          endOffset: 3,
        },
        {
          matchId: 'h-sub:0:0',
          blockId: 'h-sub',
          rootId: 'doc-root-2',
          blockType: 'other',
          subType: 'h3',
          matchedText: '标题词',
          prefixText: '',
          suffixText: '',
          previewText: '三级标题',
          segments: [{ text: '标题词', isMatch: true }],
          fullContent: '三级标题',
          sort: 2,
          updated: '20261005120000',
          created: '20261005120000',
          hpath: '/知识库/测试',
          box: 'box-1',
          selectedForReplace: true,
          startOffset: 0,
          endOffset: 3,
        },
        {
          matchId: 'generic-1:0:0',
          blockId: 'generic-1',
          rootId: 'doc-root-2',
          blockType: 'custom_widget',
          matchedText: '组件词',
          prefixText: '',
          suffixText: '',
          previewText: '自定义组件内容',
          segments: [{ text: '组件词', isMatch: true }],
          fullContent: '自定义组件内容',
          sort: 3,
          updated: '20261005120000',
          created: '20261005120000',
          hpath: '/知识库/测试',
          box: 'box-1',
          selectedForReplace: true,
          startOffset: 0,
          endOffset: 3,
        },
      ],
    }

    app = createApp(DocAggregateItem, { doc: docData })
    app.mount(host!)
    await nextTick()

    const badges = host!.querySelectorAll('.sfsr-match-item__type-badge')
    expect(badges.length).toBe(3)

    // type='h' -> 标题
    expect(badges[0].textContent?.trim()).toBe('标题')
    // subType='h3' -> 标题
    expect(badges[1].textContent?.trim()).toBe('标题')
    // 未特别细分的普通/其它块 -> 块
    expect(badges[2].textContent?.trim()).toBe('块')
  })
})
