// @vitest-environment jsdom

import type { DocAggregateNode } from '@/features/search-replace/global/types'
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  createApp,
  nextTick,
} from 'vue'
import { globalSearchState } from '@/features/search-replace/global/store'
import GlobalSearchDockView from '@/features/search-replace/global/ui/GlobalSearchDockView.vue'

// RF-203：结果列表窗口化渲染——拼音模式 limit=2000 时不全量渲染 DocAggregateItem。

const PAGE_SIZE = 50

function makeDoc(index: number): DocAggregateNode {
  return {
    rootId: `doc-${index}`,
    boxId: 'box-1',
    hpath: `/doc-${index}`,
    docTitle: `文档 ${index}`,
    updated: '20261121000000',
    created: '20261121000000',
    collapsed: false,
    totalCount: 1,
    matches: [
      {
        matchId: `doc-${index}:m1`,
        blockId: `block-${index}`,
        rootId: `doc-${index}`,
        blockType: 'p',
        matchedText: '关键词',
        prefixText: '',
        suffixText: '',
        selectedForReplace: true,
        previewText: '[关键词]',
        segments: [],
        fullContent: '关键词',
        sort: 0,
        updated: '',
        created: '',
        hpath: '',
        box: '',
        startOffset: 0,
        endOffset: 3,
      },
    ],
  }
}

describe('结果列表窗口化渲染（RF-203）', () => {
  let container: HTMLElement | null = null
  let app: ReturnType<typeof createApp> | null = null

  afterEach(() => {
    app?.unmount()
    container?.remove()
    container = null
    app = null
    globalSearchState.results = []
    globalSearchState.query = ''
    globalSearchState.searchedQuery = ''
    globalSearchState.statusMessage = undefined
  })

  function mountDock() {
    container = document.createElement('div')
    document.body.appendChild(container)
    app = createApp(GlobalSearchDockView)
    app.mount(container)
  }

  function countRenderedDocs() {
    return container!.querySelectorAll('.sfsr-doc-item').length
  }

  function getLoadMoreButton() {
    return container!.querySelector<HTMLButtonElement>('.sfsr-dock-load-more')
  }

  it('超过一页时首屏限量渲染并提供加载更多按钮', async () => {
    mountDock()
    globalSearchState.query = '关键词'
    globalSearchState.searchedQuery = '关键词'
    globalSearchState.results = Array.from({ length: PAGE_SIZE + 10 }, (_, i) => makeDoc(i))
    await nextTick()

    expect(countRenderedDocs()).toBe(PAGE_SIZE)
    const button = getLoadMoreButton()
    expect(button).not.toBeNull()
    expect(button?.textContent).toContain('10')
  })

  it('点击加载更多后渲染全部结果且按钮消失', async () => {
    mountDock()
    globalSearchState.query = '关键词'
    globalSearchState.searchedQuery = '关键词'
    globalSearchState.results = Array.from({ length: PAGE_SIZE + 10 }, (_, i) => makeDoc(i))
    await nextTick()

    getLoadMoreButton()!.click()
    await nextTick()

    expect(countRenderedDocs()).toBe(PAGE_SIZE + 10)
    expect(getLoadMoreButton()).toBeNull()
  })

  it('不超过一页时不出现加载更多按钮', async () => {
    mountDock()
    globalSearchState.query = '关键词'
    globalSearchState.searchedQuery = '关键词'
    globalSearchState.results = Array.from({ length: PAGE_SIZE - 1 }, (_, i) => makeDoc(i))
    await nextTick()

    expect(countRenderedDocs()).toBe(PAGE_SIZE - 1)
    expect(getLoadMoreButton()).toBeNull()
  })

  it('新一轮搜索结果替换后窗口重置回首屏', async () => {
    mountDock()
    globalSearchState.query = '关键词'
    globalSearchState.searchedQuery = '关键词'
    globalSearchState.results = Array.from({ length: PAGE_SIZE + 10 }, (_, i) => makeDoc(i))
    await nextTick()

    getLoadMoreButton()!.click()
    await nextTick()
    expect(countRenderedDocs()).toBe(PAGE_SIZE + 10)

    // 新搜索：results 数组整体替换（store 在每次 executeGlobalSearch 后写入新数组）
    globalSearchState.results = Array.from({ length: PAGE_SIZE + 20 }, (_, i) => makeDoc(i + 100))
    await nextTick()

    expect(countRenderedDocs()).toBe(PAGE_SIZE)
    expect(getLoadMoreButton()).not.toBeNull()
  })
})
