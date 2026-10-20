// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import GlobalSearchDockView from '@/features/search-replace/global/ui/GlobalSearchDockView.vue'
import SearchHelpPopover from '@/features/search-replace/global/ui/SearchHelpPopover.vue'
import RegexHelpPopover from '@/features/search-replace/global/ui/RegexHelpPopover.vue'
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

  it('renders RegexHelpPopover with 4 common regex items and emits select-example', async () => {
    let selectedExample = ''
    let closed = false

    const container = document.createElement('div')
    const app = createApp(RegexHelpPopover, {
      onSelectExample: (ex: string) => {
        selectedExample = ex
      },
      onClose: () => {
        closed = true
      },
    })
    app.mount(container)

    // 检查是否渲染了 4 种精选正则规则项
    const items = container.querySelectorAll('.sfsr-regex-help-item')
    expect(items.length).toBe(4)

    // 点击第二项（非贪婪匹配 【.*?】）
    const secondItem = items[1] as HTMLElement
    secondItem.click()
    expect(selectedExample).toBe('【.*?】')

    // 点击关闭按钮
    const closeBtn = container.querySelector('.sfsr-regex-help-close-btn') as HTMLElement
    closeBtn.click()
    expect(closed).toBe(true)
  })

  it('handles regex switch hover tooltip and popover interaction in dock view', async () => {
    vi.useFakeTimers()
    const container = document.createElement('div')
    const app = createApp(GlobalSearchDockView)
    app.mount(container)

    // 找到 .* 正则开关按钮
    const optButtons = Array.from(container.querySelectorAll('.sfsr-dock-segmented-group .sfsr-dock-opt-btn'))
    const regexBtn = optButtons.find(btn => btn.textContent?.trim() === '.*') as HTMLButtonElement
    expect(regexBtn).not.toBeNull()

    // 1. 正则关闭状态下：应有 b3-tooltips 及 aria-label，悬停不触发 RegexHelpPopover
    globalSearchState.options.useRegex = false
    await nextTick()

    expect(regexBtn.classList.contains('b3-tooltips')).toBe(true)
    expect(regexBtn.getAttribute('aria-label')).toBe('正则表达式 (Regex)')

    regexBtn.dispatchEvent(new MouseEvent('mouseenter'))
    vi.advanceTimersByTime(300)
    await nextTick()

    expect(container.querySelector('.sfsr-regex-help-popover')).toBeNull()

    // 2. 正则开启状态下：抑制 b3-tooltips，悬停 250ms 后展示 RegexHelpPopover
    regexBtn.click()
    await nextTick()
    expect(globalSearchState.options.useRegex).toBe(true)
    expect(regexBtn.classList.contains('b3-tooltips')).toBe(false)
    expect(regexBtn.getAttribute('aria-label')).toBeNull()

    // 快速滑过（小于 250ms 即离开）不应展示浮层
    regexBtn.dispatchEvent(new MouseEvent('mouseenter'))
    vi.advanceTimersByTime(100)
    regexBtn.dispatchEvent(new MouseEvent('mouseleave'))
    vi.advanceTimersByTime(200)
    await nextTick()
    expect(container.querySelector('.sfsr-regex-help-popover')).toBeNull()

    // 悬停达到 250ms，浮层出现
    regexBtn.dispatchEvent(new MouseEvent('mouseenter'))
    vi.advanceTimersByTime(250)
    await nextTick()

    const regexPopover = container.querySelector('.sfsr-regex-help-popover') as HTMLElement
    expect(regexPopover).not.toBeNull()

    // 点击浮层中的示例，自动填入搜索框并关闭浮层
    const firstRegexItem = regexPopover.querySelector('.sfsr-regex-help-item') as HTMLElement
    firstRegexItem.click()
    await nextTick()

    expect(globalSearchState.query).toBe('安装|部署')
    expect(container.querySelector('.sfsr-regex-help-popover')).toBeNull()

    // 3. 点击正则按钮关闭正则后，浮层立即关闭并恢复原生 tooltip
    // 重新悬停打开
    regexBtn.dispatchEvent(new MouseEvent('mouseenter'))
    vi.advanceTimersByTime(250)
    await nextTick()
    expect(container.querySelector('.sfsr-regex-help-popover')).not.toBeNull()

    // 点击关闭正则
    regexBtn.click()
    await nextTick()
    expect(globalSearchState.options.useRegex).toBe(false)
    expect(container.querySelector('.sfsr-regex-help-popover')).toBeNull()
    expect(regexBtn.classList.contains('b3-tooltips')).toBe(true)

    vi.useRealTimers()
  })
})
