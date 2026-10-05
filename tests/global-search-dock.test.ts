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
    expect(collapseBtn?.textContent?.trim()).toBe('折叠')

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
})
