// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { createApp, nextTick } from 'vue'
import DocAggregateItem from '@/features/search-replace/global/ui/DocAggregateItem.vue'
import GlobalSearchDockView from '@/features/search-replace/global/ui/GlobalSearchDockView.vue'
import WireframeIcon from '@/components/SiyuanTheme/WireframeIcon.vue'
import { globalSearchState } from '@/features/search-replace/global/store'
import type { DocAggregateNode } from '@/features/search-replace/global/types'

describe('Global Search Dock & Doc Item UI Redesign (阶段二测试)', () => {
  it('DocAggregateItem uses WireframeIcon and eliminates native title and emojis', () => {
    const dummyDoc: DocAggregateNode = {
      rootId: 'doc-1',
      boxId: 'box-1',
      hpath: '/path/to/my-doc',
      docTitle: 'My Test Document',
      updated: '20261005',
      created: '20261001',
      collapsed: false,
      totalCount: 2,
      matches: [
        {
          matchId: 'm-1',
          rootId: 'doc-1',
          blockId: 'b-1',
          blockType: 'h',
          subType: 'h2',
          boxId: 'box-1',
          hpath: '/path/to/my-doc',
          matchedText: 'keyword',
          prefixText: 'hello ',
          suffixText: ' world',
          segments: [
            { text: 'hello ', isMatch: false },
            { text: 'keyword', isMatch: true },
            { text: ' world', isMatch: false },
          ],
        },
      ],
    }

    const container = document.createElement('div')
    const app = createApp(DocAggregateItem, { doc: dummyDoc })
    app.mount(container)

    // 1. 不应包含任何原生 title 属性
    const allWithTitle = container.querySelectorAll('[title]')
    expect(allWithTitle.length).toBe(0)

    // 2. 不应包含 Emoji（如 📄 或 ▶）
    expect(container.innerHTML).not.toContain('📄')
    expect(container.innerHTML).not.toContain('▶')

    // 3. 应包含线框图标并具备 fill: none !important
    const svgs = container.querySelectorAll('svg.sfsr-wireframe-icon')
    expect(svgs.length).toBeGreaterThan(0)
    for (const svg of svgs) {
      expect(svg.getAttribute('style')).toContain('fill: none !important')
      expect(svg.getAttribute('fill')).toBe('none')
    }

    // 4. 块类型 Badge 正确展示
    const badge = container.querySelector('.sfsr-match-item__type-badge')
    expect(badge).not.toBeNull()
    expect(badge?.textContent?.trim()).toBe('标题')
    expect(badge?.classList.contains('sfsr-match-item__type-badge--h')).toBe(true)

    // 5. 命中高亮标记正常
    const mark = container.querySelector('mark.sfsr-match-item__highlight')
    expect(mark).not.toBeNull()
    expect(mark?.textContent?.trim()).toBe('keyword')

    app.unmount()
  })

  it('GlobalSearchDockView has zero native title attributes and uses b3-tooltips with WireframeIcon', async () => {
    const container = document.createElement('div')
    const app = createApp(GlobalSearchDockView)
    app.mount(container)

    // 1. 验证全局 Dock 中没有任何元素使用原生 title 属性，彻底根除双重浮层冲突
    const allTitles = container.querySelectorAll('[title]')
    expect(allTitles.length).toBe(0)

    // 2. 验证顶部操作按钮具有 b3-tooltips 与 b3-tooltips__sw (防侧栏右边界截断) 以及 aria-label
    const headerButtons = container.querySelectorAll('.sfsr-dock-action-btn')
    expect(headerButtons.length).toBe(4)
    for (const btn of headerButtons) {
      expect(btn.classList.contains('b3-tooltips')).toBe(true)
      expect(btn.classList.contains('b3-tooltips__sw')).toBe(true)
      expect(btn.hasAttribute('aria-label')).toBe(true)
      expect(btn.getAttribute('aria-label')?.length).toBeGreaterThan(0)
      // 内部渲染线框图标
      const svg = btn.querySelector('svg.sfsr-wireframe-icon')
      expect(svg).not.toBeNull()
      expect(svg?.getAttribute('style')).toContain('fill: none !important')
    }

    // 3. 验证选项栏分段状态按钮（Aa, \b, .*, 拼）具有独立 tooltips 与动态状态 aria-label，且父容器未截断
    const segGroup = container.querySelector('.sfsr-dock-segmented-group')
    expect(segGroup).not.toBeNull()
    const segButtons = container.querySelectorAll('.sfsr-dock-segmented-group .sfsr-dock-opt-btn')
    expect(segButtons.length).toBe(4)
    expect(segButtons[0].classList.contains('b3-tooltips__se')).toBe(true) // Aa 最左侧向右下展开防左截断
    expect(segButtons[0].getAttribute('aria-label')).toContain('区分大小写')
    expect(segButtons[1].getAttribute('aria-label')).toContain('全词匹配')
    expect(segButtons[2].getAttribute('aria-label')).toContain('正则表达式')
    expect(segButtons[3].classList.contains('b3-tooltips__sw')).toBe(true) // 拼 最右侧向左下展开防右截断
    expect(segButtons[3].getAttribute('aria-label')).toContain('拼音搜索')

    for (const btn of segButtons) {
      expect(btn.classList.contains('b3-tooltips')).toBe(true)
      expect(btn.hasAttribute('aria-label')).toBe(true)
    }

    // 4. 验证折叠按钮为纯线框图标，无多余文字挤压导致乱码，且配置 b3-tooltips__sw 防右侧截断
    const collapseBtn = container.querySelector('.sfsr-dock-collapse-btn') as HTMLButtonElement | null
    expect(collapseBtn).not.toBeNull()
    expect(collapseBtn?.classList.contains('b3-tooltips__sw')).toBe(true)
    expect(collapseBtn?.textContent?.trim()).toBe('')
    expect(collapseBtn?.querySelector('svg.sfsr-wireframe-icon')).not.toBeNull()

    // 5. 验证高级筛选展开后，不存在重复的展开/折叠按钮组
    const filterToggleBtn = headerButtons[3] as HTMLButtonElement
    filterToggleBtn.click()
    await nextTick()
    expect(container.querySelector('.sfsr-dock-advanced-drawer')).not.toBeNull()
    expect(container.querySelector('.sfsr-dock-sort-actions')).toBeNull()

    // 6. 验证输入清空按钮交互
    const input = container.querySelector('.sfsr-dock-input') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(container.querySelector('.sfsr-dock-clear-btn')).toBeNull()

    globalSearchState.query = 'test query'
    await nextTick()

    const clearBtn = container.querySelector('.sfsr-dock-clear-btn') as HTMLButtonElement | null
    expect(clearBtn).not.toBeNull()
    expect(clearBtn?.hasAttribute('aria-label')).toBe(true)

    clearBtn?.click()
    await nextTick()
    expect(globalSearchState.query).toBe('')

    // 7. 验证确定按钮（执行搜索）采用向左弹出 b3-tooltips__w，彻底避开下方折叠按钮的遮挡
    const searchBtn = container.querySelector('.sfsr-dock-search-btn') as HTMLButtonElement | null
    expect(searchBtn).not.toBeNull()
    expect(searchBtn?.classList.contains('b3-tooltips__w')).toBe(true)

    // 8. 验证不含任何旧版 Emoji
    expect(container.innerHTML).not.toContain('🔍')
    expect(container.innerHTML).not.toContain('⭐')
    expect(container.innerHTML).not.toContain('📋')
    expect(container.innerHTML).not.toContain('📜')
    expect(container.innerHTML).not.toContain('⚙')

    app.unmount()
  })

  it('WireframeIcon collapse-all and expand-all use parallel chevrons without overlapping intersection', () => {
    const container = document.createElement('div')
    const app = createApp({
      components: { WireframeIcon },
      template: `
        <div>
          <WireframeIcon name="collapse-all" />
          <WireframeIcon name="expand-all" />
        </div>
      `,
    })
    app.mount(container)

    // 验证 WireframeIcon 渲染出的 polyline 分布（两个图标共 4 条平行折线）
    const polylines = container.querySelectorAll('polyline')
    expect(polylines.length).toBe(4)
    // 验证 collapse-all（前两条）折线顶点向上，expand-all（后两条）折线顶点向下
    expect(polylines[0].getAttribute('points')).toBe('7 10 12 5 17 10')
    expect(polylines[1].getAttribute('points')).toBe('7 16 12 11 17 16')
    expect(polylines[2].getAttribute('points')).toBe('7 8 12 13 17 8')
    expect(polylines[3].getAttribute('points')).toBe('7 14 12 19 17 14')

    app.unmount()
  })
})
