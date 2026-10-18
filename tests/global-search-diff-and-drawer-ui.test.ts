// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { createApp } from 'vue'
import FilterPillsBar from '@/features/search-replace/global/ui/FilterPillsBar.vue'
import VisualDiffModal from '@/features/search-replace/global/ui/VisualDiffModal.vue'
import TransactionHistoryDrawer from '@/features/search-replace/global/ui/TransactionHistoryDrawer.vue'
import type { DiffSummary } from '@/features/search-replace/global/diff-builder'
import type { ReplaceTransaction } from '@/features/search-replace/global/transaction-history'

describe('Diff Modal, History Drawer & Filter Pills UI Redesign (阶段三测试)', () => {
  it('FilterPillsBar eliminates native title and renders chips without hardcoded colors', () => {
    const container = document.createElement('div')
    const app = createApp(FilterPillsBar, {
      filters: { types: ['p'] },
      notebooks: [{ id: 'nb-1', name: 'Notebook 1' }],
    })
    app.mount(container)

    // 1. 无任何原生 title 属性
    expect(container.querySelectorAll('[title]').length).toBe(0)

    // 2. 存在激活胶囊
    const activePill = container.querySelector('.sfsr-pill--active')
    expect(activePill).not.toBeNull()
    expect(activePill?.textContent?.trim()).toBe('正文')

    app.unmount()
  })

  it('VisualDiffModal uses WireframeIcon and eliminates emojis and native title', () => {
    const dummySummary: DiffSummary = {
      totalCount: 1,
      includedCount: 1,
      excludedCount: 0,
      affectedDocCount: 1,
      groups: [
        {
          rootId: 'doc-1',
          docTitle: 'Doc Title 1',
          hpath: '/path/1',
          allExcluded: false,
          items: [
            {
              matchId: 'm-1',
              rootId: 'doc-1',
              blockId: 'b-1',
              matchedText: 'oldText',
              replacedText: 'newText',
              prefixText: 'prev ',
              suffixText: ' next',
              excluded: false,
            },
          ],
        },
      ],
    }

    const container = document.createElement('div')
    const app = createApp(VisualDiffModal, {
      visible: true,
      diffSummary: dummySummary,
    })
    app.mount(container)

    // 1. 无任何原生 title 属性
    expect(container.querySelectorAll('[title]').length).toBe(0)

    // 2. 无 Emoji
    expect(container.innerHTML).not.toContain('🔄')
    expect(container.innerHTML).not.toContain('✕')
    expect(container.innerHTML).not.toContain('📄')

    // 3. 线框图标样式检验
    const svgs = container.querySelectorAll('svg.sfsr-wireframe-icon')
    expect(svgs.length).toBeGreaterThan(0)
    for (const svg of svgs) {
      expect(svg.getAttribute('style')).toContain('fill: none !important')
    }

    // 4. 差异对比行渲染检验
    const delBadge = container.querySelector('.sfsr-diff-badge--del')
    const insBadge = container.querySelector('.sfsr-diff-badge--ins')
    expect(delBadge).not.toBeNull()
    expect(insBadge).not.toBeNull()
    expect(container.querySelector('.sfsr-del-highlight')?.textContent).toBe('oldText')
    expect(container.querySelector('.sfsr-ins-highlight')?.textContent).toBe('newText')

    app.unmount()
  })

  it('VisualDiffModal supports collapsing documents individually and in batch', async () => {
    const multiDocSummary: DiffSummary = {
      totalCount: 2,
      includedCount: 2,
      excludedCount: 0,
      affectedDocCount: 2,
      groups: [
        {
          rootId: 'doc-1',
          docTitle: 'Doc 1',
          hpath: '/path/1',
          allExcluded: false,
          items: [
            {
              matchId: 'm-1',
              rootId: 'doc-1',
              blockId: 'b-1',
              matchedText: 'apple',
              replacedText: 'orange',
              prefixText: 'a ',
              suffixText: ' b',
              excluded: false,
            },
          ],
        },
        {
          rootId: 'doc-2',
          docTitle: 'Doc 2',
          hpath: '/path/2',
          allExcluded: false,
          items: [
            {
              matchId: 'm-2',
              rootId: 'doc-2',
              blockId: 'b-2',
              matchedText: 'cat',
              replacedText: 'dog',
              prefixText: 'c ',
              suffixText: ' d',
              excluded: false,
            },
          ],
        },
      ],
    }

    const container = document.createElement('div')
    const app = createApp(VisualDiffModal, {
      visible: true,
      diffSummary: multiDocSummary,
    })
    app.mount(container)

    const groupHeaders = container.querySelectorAll<HTMLElement>('.sfsr-diff-group-header')
    const itemsLists = container.querySelectorAll<HTMLElement>('.sfsr-diff-items-list')
    expect(groupHeaders.length).toBe(2)
    expect(itemsLists.length).toBe(2)

    // 初始状态：全部展开
    expect(itemsLists[0].style.display).not.toBe('none')
    expect(itemsLists[1].style.display).not.toBe('none')

    // 1. 点击第一个文档头部：折叠该文档
    groupHeaders[0].click()
    await new Promise(r => setTimeout(r, 10))
    expect(itemsLists[0].style.display).toBe('none')
    expect(itemsLists[1].style.display).not.toBe('none')

    // 再次点击：展开
    groupHeaders[0].click()
    await new Promise(r => setTimeout(r, 10))
    expect(itemsLists[0].style.display).not.toBe('none')

    // 2. 全部折叠
    const quickBtns = Array.from(container.querySelectorAll<HTMLButtonElement>('.sfsr-diff-text-btn'))
    const collapseAllBtn = quickBtns.find(b => b.textContent?.trim() === '全部折叠')
    const expandAllBtn = quickBtns.find(b => b.textContent?.trim() === '全部展开')
    expect(collapseAllBtn).toBeDefined()
    expect(expandAllBtn).toBeDefined()

    collapseAllBtn?.click()
    await new Promise(r => setTimeout(r, 10))
    expect(itemsLists[0].style.display).toBe('none')
    expect(itemsLists[1].style.display).toBe('none')

    // 3. 全部展开
    expandAllBtn?.click()
    await new Promise(r => setTimeout(r, 10))
    expect(itemsLists[0].style.display).not.toBe('none')
    expect(itemsLists[1].style.display).not.toBe('none')

    app.unmount()
  })

  it('TransactionHistoryDrawer uses WireframeIcon and eliminates emojis and native title', () => {
    const dummyTransactions: ReplaceTransaction[] = [
      {
        id: 'tx-1',
        timestamp: Date.now(),
        formattedTime: '2026-10-05 22:00:00',
        query: 'searchWord',
        replacement: 'replaceWord',
        itemCount: 3,
        affectedDocCount: 1,
        reverted: false,
        snapshots: [],
      },
    ]

    const container = document.createElement('div')
    const app = createApp(TransactionHistoryDrawer, {
      visible: true,
      transactions: dummyTransactions,
    })
    app.mount(container)

    // 1. 无任何原生 title 属性
    expect(container.querySelectorAll('[title]').length).toBe(0)

    // 2. 无 Emoji
    expect(container.innerHTML).not.toContain('📜')
    expect(container.innerHTML).not.toContain('✕')
    expect(container.innerHTML).not.toContain('➔')

    // 3. 线框图标检验
    const svgs = container.querySelectorAll('svg.sfsr-wireframe-icon')
    expect(svgs.length).toBeGreaterThan(0)
    for (const svg of svgs) {
      expect(svg.getAttribute('style')).toContain('fill: none !important')
    }

    // 4. 卡片内容检验
    expect(container.querySelector('.sfsr-tx-query')?.textContent).toContain('searchWord')
    expect(container.querySelector('.sfsr-tx-repl')?.textContent).toContain('replaceWord')
    expect(container.querySelector('.sfsr-revert-btn')?.textContent?.trim()).toBe('一键回退')

    app.unmount()
  })

  it('TransactionHistoryDrawer expands card and displays documents and paragraph Visual Diff details', async () => {
    const detailedTx: ReplaceTransaction[] = [
      {
        id: 'tx-detail-1',
        timestamp: Date.now(),
        formattedTime: '2026-10-18 21:09:39',
        query: '深圳',
        replacement: '广州',
        itemCount: 2,
        reverted: false,
        items: [
          {
            blockId: 'b-1',
            rootId: 'doc-1',
            docTitle: '深圳地铁全景',
            hpath: '/travel/sz',
            matchedText: '深圳',
            replacedText: '广州',
            prefixText: '好玩的',
            suffixText: '地铁6号线',
            fullContent: '好玩的深圳地铁6号线',
            newContent: '好玩的广州地铁6号线',
          },
          {
            blockId: 'b-2',
            rootId: 'doc-1',
            docTitle: '深圳地铁全景',
            hpath: '/travel/sz',
            matchedText: '深圳',
            replacedText: '广州',
            prefixText: '逛逛',
            suffixText: '美术馆',
            fullContent: '逛逛深圳美术馆',
            newContent: '逛逛广州美术馆',
          },
        ],
      },
    ]

    const container = document.createElement('div')
    const app = createApp(TransactionHistoryDrawer, {
      visible: true,
      transactions: detailedTx,
    })
    app.mount(container)

    // 1. 初始状态：明细区域未展开
    expect(container.querySelector('.sfsr-history-card-body')).toBeNull()

    // 2. 点击卡片头部：展开明细
    const cardHeader = container.querySelector<HTMLElement>('.sfsr-history-card-header')
    expect(cardHeader).not.toBeNull()
    cardHeader?.click()
    await new Promise(r => setTimeout(r, 10))

    const cardBody = container.querySelector('.sfsr-history-card-body')
    expect(cardBody).not.toBeNull()

    // 3. 文档分组检验
    const docHeader = container.querySelector('.sfsr-history-doc-header')
    expect(docHeader).not.toBeNull()
    expect(container.querySelector('.sfsr-history-doc-title')?.textContent).toBe('深圳地铁全景')
    expect(container.querySelector('.sfsr-history-doc-count')?.textContent).toBe('2 处')

    // 4. 段落 Visual Diff 渲染检验
    const diffItems = container.querySelectorAll('.sfsr-history-diff-item')
    expect(diffItems.length).toBe(2)
    expect(container.querySelector('.sfsr-del-highlight')?.textContent).toBe('深圳')
    expect(container.querySelector('.sfsr-ins-highlight')?.textContent).toBe('广州')

    // 5. 文档单篇折叠检验
    const docItemsContainer = container.querySelector<HTMLElement>('.sfsr-history-doc-items')
    expect(docItemsContainer?.style.display).not.toBe('none')

    const docHeaderEl = container.querySelector<HTMLElement>('.sfsr-history-doc-header')
    docHeaderEl?.click()
    await new Promise(r => setTimeout(r, 10))
    expect(docItemsContainer?.style.display).toBe('none')

    app.unmount()
  })
})
