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
})
