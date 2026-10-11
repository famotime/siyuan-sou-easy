// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import {
  destroyGlobalSearchDock,
  initGlobalSearchDock,
  toggleGlobalSearchDock,
} from '@/features/search-replace/global/dock-manager'
import {
  globalSearchState,
  toggleAllDocsCollapse,
  toggleGlobalOption,
  toggleGlobalReplace,
} from '@/features/search-replace/global/store'

describe('dock-manager', () => {
  it('mounts and unmounts global search dock view into element', () => {
    const dockEl = document.createElement('div')
    initGlobalSearchDock(dockEl)

    expect(dockEl.querySelector('.sfsr-dock-container')).not.toBeNull()
    expect(dockEl.querySelector('.sfsr-dock-panel')).not.toBeNull()
    expect(dockEl.querySelector('.sfsr-dock-input')).not.toBeNull()

    // 标题栏操作图标
    expect(dockEl.querySelector('.sfsr-dock-header-actions')).not.toBeNull()

    // 展开/折叠替换行按钮
    expect(dockEl.querySelector('.sfsr-dock-toggle-replace-btn')).not.toBeNull()

    const docOnlySwitch = dockEl.querySelector('.sfsr-dock-switch') as HTMLInputElement | null
    expect(docOnlySwitch).not.toBeNull()
    expect(docOnlySwitch?.checked).toBe(true)

    const collapseBtn = dockEl.querySelector('.sfsr-dock-collapse-btn') as HTMLButtonElement | null
    expect(collapseBtn).not.toBeNull()
    expect(collapseBtn?.getAttribute('aria-label')).toBe('全部折叠文档')
    expect(collapseBtn?.querySelector('svg.sfsr-wireframe-icon')).not.toBeNull()

    destroyGlobalSearchDock()
  })

  it('toggles all docs between collapsed and expanded when button clicked', async () => {
    globalSearchState.results = [
      {
        rootId: 'doc-1',
        boxId: 'box-1',
        hpath: '/d1',
        docTitle: 'd1',
        updated: '',
        created: '',
        collapsed: false,
        totalCount: 1,
        matches: [],
      },
      {
        rootId: 'doc-2',
        boxId: 'box-1',
        hpath: '/d2',
        docTitle: 'd2',
        updated: '',
        created: '',
        collapsed: false,
        totalCount: 1,
        matches: [],
      },
    ]

    // 初始全部展开
    expect(globalSearchState.results.every(d => !d.collapsed)).toBe(true)

    // 第一次切换：全部折叠
    toggleAllDocsCollapse()
    expect(globalSearchState.results.every(d => d.collapsed)).toBe(true)

    // 第二次切换：全部展开
    toggleAllDocsCollapse()
    expect(globalSearchState.results.every(d => !d.collapsed)).toBe(true)

    // 清理
    globalSearchState.results = []
  })

  it('supports toggling replace row and preloading query', () => {
    globalSearchState.replaceVisible = false
    toggleGlobalReplace()
    expect(globalSearchState.replaceVisible).toBe(true)

    toggleGlobalReplace()
    expect(globalSearchState.replaceVisible).toBe(false)

    // 测试 toggleGlobalSearchDock(true) 展开替换模式
    toggleGlobalSearchDock(true)
    expect(globalSearchState.replaceVisible).toBe(true)
  })

  it('invalidates old results immediately on draft query change and shows draft prompt', async () => {
    const dockEl = document.createElement('div')
    initGlobalSearchDock(dockEl)

    const dummyDoc = {
      rootId: 'doc-1',
      boxId: 'box-1',
      hpath: '/d1',
      docTitle: 'd1',
      updated: '',
      created: '',
      collapsed: false,
      totalCount: 1,
      matches: [],
    }

    // 1. 模拟已完成“foo”的搜索结果
    globalSearchState.query = 'foo'
    globalSearchState.searchedQuery = 'foo'
    globalSearchState.results = [dummyDoc]
    globalSearchState.statusMessage = '共命中 1 篇文档，1 处匹配'

    const { nextTick } = await import('vue')
    await nextTick()

    // 此时应显示结果卡片和状态栏
    expect(dockEl.querySelector('.sfsr-dock-results')).not.toBeNull()
    expect(dockEl.querySelector('.sfsr-dock-status')?.textContent).toContain('共命中 1 篇文档')

    // 2. 用户修改关键词为“bar”，未发送回车（进入草稿态）
    globalSearchState.query = 'bar'
    await nextTick()

    // 旧结果与旧统计栏必须立即被彻底清空，防止出现旧词闪现的困惑
    expect(globalSearchState.results.length).toBe(0)
    expect(globalSearchState.statusMessage).toBeUndefined()
    expect(dockEl.querySelector('.sfsr-dock-status')).toBeNull()
    expect(dockEl.querySelector('.sfsr-dock-results')).toBeNull()

    // 提示区应展示静态草稿提示“按 Enter 检索: bar”
    const draftEmpty = dockEl.querySelector('.sfsr-dock-empty--draft')
    expect(draftEmpty).not.toBeNull()
    expect(draftEmpty?.textContent).toContain('按 Enter 检索: bar')

    // 3. 用户删除搜索词为空
    globalSearchState.query = ''
    await nextTick()

    expect(dockEl.querySelector('.sfsr-dock-empty--hint')?.textContent).toContain('输入关键词并按 Enter 全库检索')

    destroyGlobalSearchDock()
  })

  it('does not auto-trigger search when toggling options in draft state', async () => {
    // 设置为草稿态：当前输入词为 'draftWord'，但最后已搜索词为 ''
    globalSearchState.query = 'draftWord'
    globalSearchState.searchedQuery = ''
    globalSearchState.results = []

    const initialMatchCase = globalSearchState.options.matchCase
    toggleGlobalOption('matchCase')

    // 选项开关成功切换
    expect(globalSearchState.options.matchCase).toBe(!initialMatchCase)
    // 但并未执行搜索，searchedQuery 仍然保持未执行状态，结果仍为空
    expect(globalSearchState.searchedQuery).toBe('')
    expect(globalSearchState.results.length).toBe(0)
  })
})
