// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import ReplaceHistoryTabView from '@/features/search-replace/global/ui/ReplaceHistoryTabView.vue'
import {
  destroyReplaceHistoryTab,
  initReplaceHistoryTab,
} from '@/features/search-replace/global/history-tab-manager'
import * as txHistory from '@/features/search-replace/global/transaction-history'
import type { ReplaceTransaction } from '@/features/search-replace/global/transaction-history'

describe('ReplaceHistoryTabView (分屏页签打开批量替换历史测试)', () => {
  const dummyTransactions: ReplaceTransaction[] = [
    {
      id: 'tx-tab-1',
      timestamp: Date.now(),
      formattedTime: '2026-10-18 22:00:00',
      query: '深圳',
      replacement: '广州',
      itemCount: 2,
      reverted: false,
      items: [
        {
          blockId: 'b-tab-1',
          rootId: 'doc-tab-1',
          docTitle: '深圳漫游记',
          hpath: '/guide/sz',
          matchedText: '深圳',
          replacedText: '广州',
          prefixText: '美丽的',
          suffixText: '市中心',
          fullContent: '美丽的美丽的深圳市中心',
          newContent: '美丽的美丽的广州市中心',
        },
        {
          blockId: 'b-tab-2',
          rootId: 'doc-tab-1',
          docTitle: '深圳漫游记',
          hpath: '/guide/sz',
          matchedText: '深圳',
          replacedText: '广州',
          prefixText: '乘坐',
          suffixText: '地铁',
          fullContent: '乘坐深圳地铁',
          newContent: '乘坐广州地铁',
        },
      ],
    },
  ]

  it('renders tab header, wireframe icons and eliminates emojis', () => {
    const container = document.createElement('div')
    const app = createApp(ReplaceHistoryTabView, {
      initialTransactions: dummyTransactions,
    })
    app.mount(container)

    // 1. 无 Emoji
    expect(container.innerHTML).not.toContain('📜')
    expect(container.innerHTML).not.toContain('✕')
    expect(container.innerHTML).not.toContain('➔')

    // 2. 线框图标样式
    const svgs = container.querySelectorAll('svg.sfsr-wireframe-icon')
    expect(svgs.length).toBeGreaterThan(0)
    for (const svg of svgs) {
      expect(svg.getAttribute('style')).toContain('fill: none !important')
    }

    // 3. 卡片基本信息
    expect(container.querySelector('.sfsr-history-tab-title')?.textContent).toContain('替换事务历史')
    expect(container.querySelector('.sfsr-tx-query')?.textContent).toContain('深圳')
    expect(container.querySelector('.sfsr-tx-repl')?.textContent).toContain('广州')
    expect(container.querySelector('.sfsr-revert-btn')?.textContent?.trim()).toBe('一键回退')

    app.unmount()
  })

  it('supports card expand/collapse and renders documents & visual diff details', async () => {
    const container = document.createElement('div')
    const app = createApp(ReplaceHistoryTabView, {
      initialTransactions: dummyTransactions,
    })
    app.mount(container)

    // 初始状态未展开明细
    expect(container.querySelector('.sfsr-history-card-body')).toBeNull()

    // 点击卡片头部展开
    const cardHeader = container.querySelector<HTMLElement>('.sfsr-history-card-header')
    cardHeader?.click()
    await new Promise(r => setTimeout(r, 10))

    const cardBody = container.querySelector('.sfsr-history-card-body')
    expect(cardBody).not.toBeNull()

    // 验证文档分组和段落对比
    expect(container.querySelector('.sfsr-history-doc-title')?.textContent).toBe('深圳漫游记')
    expect(container.querySelector('.sfsr-del-highlight')?.textContent).toBe('深圳')
    expect(container.querySelector('.sfsr-ins-highlight')?.textContent).toBe('广州')

    // 验证点击对比项会调用 navigateToBlock
    const navSpy = vi.spyOn(txHistory, 'navigateToBlock').mockResolvedValue()
    const diffItem = container.querySelector<HTMLElement>('.sfsr-history-diff-item')
    diffItem?.click()
    expect(navSpy).toHaveBeenCalledWith('b-tab-1')

    app.unmount()
  })

  it('initReplaceHistoryTab and destroyReplaceHistoryTab manage lifecycle cleanly', () => {
    const parentEl = document.createElement('div')
    initReplaceHistoryTab(parentEl)
    expect(parentEl.querySelector('.sfsr-history-tab-view')).not.toBeNull()

    destroyReplaceHistoryTab(parentEl)
    expect(parentEl.innerHTML).toBe('')
  })
})
