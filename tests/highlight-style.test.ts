import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  describe,
  expect,
  it,
} from 'vitest'

describe('search highlight styling', () => {
  it('makes the current match visually stronger than other matches', () => {
    const stylesheet = readFileSync(resolve(__dirname, '../src/index.scss'), 'utf-8')

    expect(stylesheet).toContain('.protyle-wysiwyg .sfsr-block-current {')
    expect(stylesheet).toContain('background: rgba(255, 214, 102, 0.12);')
    expect(stylesheet).toContain('inset 4px 0 0 rgba(214, 168, 0, 0.96);')

    expect(stylesheet).toContain('::highlight(sfsr-match) {')
    expect(stylesheet).toContain('background: rgba(255, 196, 0, 0.22);')

    expect(stylesheet).toContain('::highlight(sfsr-current-match) {')
    expect(stylesheet).toContain('background: rgba(232, 176, 0, 0.42);')
    expect(stylesheet).toContain('text-decoration-color: rgba(176, 122, 0, 0.96);')
    expect(stylesheet).toContain('text-decoration-thickness: 3px;')
    expect(stylesheet).toContain('text-decoration-skip-ink: none;')
    expect(stylesheet).toContain('.protyle-wysiwyg .sfsr-av-cell-match {')
    expect(stylesheet).toContain('.protyle-wysiwyg .sfsr-av-cell-current {')
  })

  it('uses a compact vscode-like two-row toolbar when replace is expanded', () => {
    const stylesheet = readFileSync(resolve(__dirname, '../src/index.scss'), 'utf-8')

    expect(stylesheet).toContain('--sfsr-toolbar-gap: 6px;')
    expect(stylesheet).toContain('--sfsr-control-height: 30px;')

    expect(stylesheet).toContain('.sfsr-layout--replace-visible {')
    expect(stylesheet).toContain('align-items: stretch;')

    expect(stylesheet).toContain('.sfsr-replace-toggle--expanded {')
    expect(stylesheet).toContain('height: auto;')
    expect(stylesheet).toContain('align-self: stretch;')

    expect(stylesheet).toContain('.sfsr-main {')
    expect(stylesheet).toContain('gap: var(--sfsr-toolbar-gap);')
  })

  it('strengthens panel chrome in dark theme so the popup separates from document content', () => {
    const stylesheet = readFileSync(resolve(__dirname, '../src/index.scss'), 'utf-8')

    expect(stylesheet).toContain('--sfsr-panel-border-color: var(--b3-border-color);')
    expect(stylesheet).toContain('--sfsr-panel-background: var(--b3-theme-background);')
    expect(stylesheet).toContain('--sfsr-panel-outline: transparent;')
    expect(stylesheet).toContain("body[data-theme-mode='dark']")
    expect(stylesheet).toContain("body[data-theme-style='dark']")
    expect(stylesheet).toContain('--sfsr-panel-border-color: rgba(148, 190, 255, 0.42);')
    expect(stylesheet).toContain('--sfsr-panel-background: #181c24;')
    expect(stylesheet).toContain('inset 0 0 0 1px var(--sfsr-panel-outline);')
    expect(stylesheet).toContain('0 0 0 3px rgba(9, 12, 18, 0.82)')
    expect(stylesheet).toContain('0 24px 54px rgba(0, 0, 0, 0.48)')
  })
})
