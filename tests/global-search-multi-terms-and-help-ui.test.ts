// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { createApp, nextTick } from 'vue'
import GlobalSearchDockView from '@/features/search-replace/global/ui/GlobalSearchDockView.vue'
import SearchHelpPopover from '@/features/search-replace/global/ui/SearchHelpPopover.vue'
import { globalSearchState } from '@/features/search-replace/global/store'
import type { DocAggregateNode } from '@/features/search-replace/global/types'

describe('Global Search Multi-terms and Help UI', () => {
  it('renders SearchHelpPopover and emits select-example event on click', async () => {
    let selectedExample = ''
    let closed = false

    const container = document.createElement('div')
    const app = createApp(SearchHelpPopover, {
      onSelectExample: (ex: string) => {
        selectedExample = ex
      },
      onClose: () => {
        closed = true
      },
    })
    app.mount(container)

    // 检查是否渲染了 5 种典型语法规则项
    const items = container.querySelectorAll('.sfsr-search-help-item')
    expect(items.length).toBe(5)

    // 点击第一项（多词 AND 样例）
    const firstItem = items[0] as HTMLElement
    firstItem.click()
    expect(selectedExample).toContain('思源 插件')

    // 点击关闭按钮
    const closeBtn = container.querySelector('.sfsr-search-help-close-btn') as HTMLElement
    closeBtn.click()
    expect(closed).toBe(true)
  })

  it('embeds help icon in search dock and handles multi-term replace button security disabling', async () => {
    const container = document.createElement('div')
    const app = createApp(GlobalSearchDockView)
    app.mount(container)

    // 1. 检查搜索输入框内右侧帮助问号按钮
    const helpBtn = container.querySelector('.sfsr-dock-help-btn')
    expect(helpBtn).not.toBeNull()
    expect(helpBtn?.getAttribute('aria-label')).toBe('搜索语法与样例')

    // 2. 展开替换栏
    globalSearchState.replaceVisible = true
    await nextTick()

    const dummyResults: DocAggregateNode[] = [
      {
        rootId: 'doc-1',
        boxId: 'box-1',
        hpath: '/test',
        docTitle: 'Test Doc',
        updated: '20261010',
        created: '20261010',
        matches: [],
        collapsed: false,
        totalCount: 1,
      },
    ]

    // 3. 当输入单一关键词时，替换按钮正常启用
    globalSearchState.query = '单一关键词'
    globalSearchState.searchedQuery = '单一关键词'
    globalSearchState.results = dummyResults
    await nextTick()

    const replaceBtn = container.querySelector('.sfsr-dock-preview-btn') as HTMLButtonElement
    expect(replaceBtn).not.toBeNull()
    expect(replaceBtn.disabled).toBe(false)
    expect(replaceBtn.getAttribute('aria-label')).toBe('差异预览与替换')

    // 4. 当输入多关键词组合（空格分隔 AND）时，替换按钮置灰禁用并给出安全提示
    globalSearchState.query = '关键词A 关键词B'
    globalSearchState.searchedQuery = '关键词A 关键词B'
    globalSearchState.results = dummyResults
    await nextTick()

    expect(replaceBtn.disabled).toBe(true)
    expect(replaceBtn.getAttribute('aria-label')).toBe('组合搜索不支持批量替换')
    expect(replaceBtn.classList.contains('b3-tooltips__w')).toBe(true)

    // 5. 当输入单精确短语（双引号包裹）时，支持作为整体替换
    globalSearchState.query = '"精确 短语"'
    globalSearchState.searchedQuery = '"精确 短语"'
    globalSearchState.results = dummyResults
    await nextTick()

    expect(replaceBtn.disabled).toBe(false)
    expect(replaceBtn.getAttribute('aria-label')).toBe('差异预览与替换')
  })

  it('ensures help button eliminates b3-tooltips to prevent conflict and popover auto fits narrow sidebar', async () => {
    const container = document.createElement('div')
    const app = createApp(GlobalSearchDockView)
    app.mount(container)

    const helpBtn = container.querySelector('.sfsr-dock-help-btn') as HTMLElement
    expect(helpBtn).not.toBeNull()
    // 必须去除 b3-tooltips，防止思源原生黑色小提示重叠遮挡
    expect(helpBtn.classList.contains('b3-tooltips')).toBe(false)

    // 点击问号图标打开帮助卡片
    helpBtn.click()
    await nextTick()

    const popover = container.querySelector('.sfsr-search-help-popover') as HTMLElement
    expect(popover).not.toBeNull()
    // 帮助卡片必须直接挂载在 search-box 容器下以便自适应宽度
    const searchBox = container.querySelector('.sfsr-dock-search-box') as HTMLElement
    expect(popover.parentElement).toBe(searchBox)
  })
})
