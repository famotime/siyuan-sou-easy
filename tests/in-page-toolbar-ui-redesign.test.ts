// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { createApp } from 'vue'
import SearchToolbarRow from '@/features/search-replace/ui/SearchToolbarRow.vue'
import ReplaceActionRow from '@/features/search-replace/ui/ReplaceActionRow.vue'

describe('In-Page Floating Panel Toolbar UI Redesign (阶段四测试)', () => {
  it('SearchToolbarRow equips all buttons with aria-label, consistent title, and explicit SVG wireframe protection', () => {
    const container = document.createElement('div')
    const app = createApp(SearchToolbarRow, {
      currentIndex: 1,
      totalMatches: 5,
      isMobile: false,
      matchCase: false,
      wholeWord: false,
      useRegex: false,
      selectionOnly: false,
      query: 'keyword',
      onClose: () => {},
      onFindCompositionEnd: () => {},
      onFindCompositionStart: () => {},
      onFindEnter: () => {},
      onFindInput: () => {},
      onGoNext: () => {},
      onGoPrev: () => {},
      onSelectionOnlyClick: () => {},
      onSelectionOnlyPointerDown: () => {},
      onToggleOption: () => {},
    })
    app.mount(container)

    // 1. 选项按钮 (Aa, \b, .*) 和操作按钮 (prev, next, selection, close) 均包含 aria-label 和 title
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThanOrEqual(7)
    for (const btn of buttons) {
      expect(btn.hasAttribute('aria-label')).toBe(true)
      expect(btn.getAttribute('aria-label')?.length).toBeGreaterThan(0)
      expect(btn.hasAttribute('title')).toBe(true)
    }

    // 2. 所有 SVG 图标均具备显式 style="fill: none !important;"，防止思源 CSS 覆盖 fill 属性
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThanOrEqual(5)
    for (const svg of svgs) {
      const style = svg.getAttribute('style') || ''
      expect(style).toContain('fill: none !important')
      expect(svg.getAttribute('fill')).toBe('none')
    }

    app.unmount()
  })

  it('ReplaceActionRow equips all buttons with aria-label, consistent title, and explicit SVG wireframe protection', () => {
    const container = document.createElement('div')
    const app = createApp(ReplaceActionRow, {
      canReplaceAll: true,
      canReplaceCurrent: true,
      hasMatches: true,
      isMobile: false,
      preserveCase: false,
      replaceInputDisabled: false,
      replacement: 'newText',
      onExtractAll: () => {},
      onReplaceAll: () => {},
      onReplaceCompositionEnd: () => {},
      onReplaceCompositionStart: () => {},
      onReplaceCurrent: () => {},
      onReplaceInput: () => {},
      onSkipCurrent: () => {},
      onTogglePreserveCase: () => {},
    })
    app.mount(container)

    // 1. 按钮均具备 aria-label 与 title
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThanOrEqual(5)
    for (const btn of buttons) {
      expect(btn.hasAttribute('aria-label')).toBe(true)
      expect(btn.getAttribute('aria-label')?.length).toBeGreaterThan(0)
      expect(btn.hasAttribute('title')).toBe(true)
    }

    // 2. 所有 SVG 图标均具备显式 style="fill: none !important;"，防止思源 CSS 覆盖 fill 属性
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThanOrEqual(4)
    for (const svg of svgs) {
      const style = svg.getAttribute('style') || ''
      expect(style).toContain('fill: none !important')
      expect(svg.getAttribute('fill')).toBe('none')
    }

    app.unmount()
  })
})
