// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import {
  destroyGlobalSearchDock,
  initGlobalSearchDock,
} from '@/features/search-replace/global/dock-manager'

describe('dock-manager', () => {
  it('mounts and unmounts global search dock view into element', () => {
    const dockEl = document.createElement('div')
    initGlobalSearchDock(dockEl)

    expect(dockEl.querySelector('.sfsr-dock-container')).not.toBeNull()
    expect(dockEl.querySelector('.sfsr-dock-panel')).not.toBeNull()
    expect(dockEl.querySelector('.sfsr-dock-input')).not.toBeNull()

    const docOnlySwitch = dockEl.querySelector('.sfsr-dock-switch') as HTMLInputElement | null
    expect(docOnlySwitch).not.toBeNull()
    expect(docOnlySwitch?.checked).toBe(true)

    const collapseBtn = dockEl.querySelector('.sfsr-dock-collapse-btn') as HTMLButtonElement | null
    expect(collapseBtn).not.toBeNull()
    expect(collapseBtn?.textContent?.trim()).toBe('全部折叠')

    destroyGlobalSearchDock()
  })

  it('toggles all docs between collapsed and expanded when button clicked', async () => {
    const { globalSearchState, toggleAllDocsCollapse } = await import('@/features/search-replace/global/store')
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
})
