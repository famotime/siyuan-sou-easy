// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import {
  applyReplacementsToClone,
  getBlockPlainText,
} from '@/features/search-replace/editor'

function createBlockFromHtml(html: string) {
  const block = document.createElement('div')
  block.dataset.nodeId = 'block-1'
  block.dataset.type = 'NodeParagraph'
  block.innerHTML = html
  return block
}

describe('applyReplacementsToClone', () => {
  it('applies multiple replacements in the same text node', () => {
    const block = createBlockFromHtml('<div contenteditable="true">foo foo foo</div>')
    const outcome = applyReplacementsToClone(
      block,
      [
        { end: 3, matchedText: 'foo', start: 0 },
        { end: 7, matchedText: 'foo', start: 4 },
        { end: 11, matchedText: 'foo', start: 8 },
      ],
      'bar',
    )

    expect(outcome.appliedCount).toBe(3)
    expect(outcome.clone).not.toBeNull()
    expect(getBlockPlainText(outcome.clone as HTMLElement)).toBe('bar bar bar')
  })

  it('preserves replacement case when enabled', () => {
    const block = createBlockFromHtml('<div contenteditable="true">FOO Foo foo</div>')
    const outcome = applyReplacementsToClone(
      block,
      [
        { end: 3, matchedText: 'FOO', start: 0 },
        { end: 7, matchedText: 'Foo', start: 4 },
        { end: 11, matchedText: 'foo', start: 8 },
      ],
      'bar',
      { preserveCase: true },
    )

    expect(outcome.appliedCount).toBe(3)
    expect(outcome.clone).not.toBeNull()
    expect(getBlockPlainText(outcome.clone as HTMLElement)).toBe('BAR Bar bar')
  })

  it('returns no replacement when range spans across text nodes', () => {
    const block = createBlockFromHtml('<div contenteditable="true">fo<strong>o</strong></div>')
    const outcome = applyReplacementsToClone(
      block,
      [{ end: 3, matchedText: 'foo', start: 0 }],
      'bar',
    )

    expect(outcome.appliedCount).toBe(0)
    expect(outcome.clone).toBeNull()
  })
})
