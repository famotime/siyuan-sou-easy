// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { createApp } from 'vue'
import fs from 'node:fs'
import path from 'node:path'
import WireframeIcon from '@/components/SiyuanTheme/WireframeIcon.vue'

function renderIcon(props: Record<string, any>) {
  const container = document.createElement('div')
  const app = createApp(WireframeIcon, props)
  app.mount(container)
  return {
    container,
    svg: container.querySelector('svg') as SVGElement | null,
    unmount: () => app.unmount(),
  }
}

describe('UI Design Tokens & Wireframe Icons (阶段一测试)', () => {
  it('WireframeIcon renders SVG with explicit fill: none !important and stroke styling', () => {
    const { svg, unmount } = renderIcon({
      name: 'search',
      size: 16,
      strokeWidth: 1.8,
    })

    expect(svg).not.toBeNull()
    expect(svg!.classList.contains('sfsr-wireframe-icon')).toBe(true)
    expect(svg!.getAttribute('fill')).toBe('none')
    expect(svg!.getAttribute('stroke')).toBe('currentColor')
    expect(svg!.getAttribute('stroke-width')).toBe('1.8')
    expect(svg!.getAttribute('viewBox')).toBe('0 0 24 24')

    // 关键规范：必须显式声明 style 包含 fill: none !important
    const styleAttr = svg!.getAttribute('style') || ''
    expect(styleAttr).toContain('fill: none !important')
    expect(styleAttr).toContain('width: 16px')
    expect(styleAttr).toContain('height: 16px')

    unmount()
  })

  it('WireframeIcon renders correct child elements for different icon names', () => {
    const iconNames = [
      'search',
      'star',
      'preset',
      'export',
      'history',
      'filter',
      'clear',
      'document',
      'chevron-down',
      'chevron-right',
      'chevron',
      'diff',
      'whole-word',
      'close',
      'revert',
      'settings',
      'copy',
      'code',
      'enter',
    ]

    for (const name of iconNames) {
      const { svg, unmount } = renderIcon({ name })
      expect(svg).not.toBeNull()
      // 保证每个图标都渲染了具体图形（不是空 svg）
      expect(svg!.children.length).toBeGreaterThan(0)
      // 保证 style 均含 fill: none !important
      expect(svg!.getAttribute('style')).toContain('fill: none !important')
      unmount()
    }
  })

  it('index.scss contains semantic CSS tokens and SVG wireframe protection rule', () => {
    const scssPath = path.resolve(__dirname, '../src/index.scss')
    const scssContent = fs.readFileSync(scssPath, 'utf-8')

    // 验证设计系统语义变量
    expect(scssContent).toContain('--sfsr-bg-panel')
    expect(scssContent).toContain('--sfsr-bg-surface')
    expect(scssContent).toContain('--sfsr-text-primary')
    expect(scssContent).toContain('--sfsr-diff-del-bg')
    expect(scssContent).toContain('--sfsr-diff-ins-bg')

    // 验证线框防护规则
    expect(scssContent).toContain('.sfsr-wireframe-icon')
    expect(scssContent).toContain('fill: none !important')
    expect(scssContent).toContain('stroke: currentColor !important')
  })
})
