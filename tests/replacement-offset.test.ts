// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import {
  applyReplacementsToClone,
  getBlockElement,
  getBlockPlainText,
  isRangeReplaceable,
} from '@/features/search-replace/editor'
import type { EditorContext } from '@/features/search-replace/types'

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

  it('replaces text in the actual heading block when metadata with the same node id exists', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-wysiwyg">
          <div class="protyle-attr" data-node-id="heading-1"></div>
          <div data-node-id="heading-1" data-type="NodeHeading" class="h1">
            <div contenteditable="true">插件安装指南</div>
          </div>
        </div>
      </div>
    `

    const context: EditorContext = {
      protyle: document.querySelector('.protyle') as HTMLElement,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    const block = getBlockElement(context, 'heading-1')
    const outcome = applyReplacementsToClone(
      block as HTMLElement,
      [{ end: 4, matchedText: '安装', start: 2 }],
      '部署',
    )

    expect(block?.dataset.type).toBe('NodeHeading')
    expect(outcome.appliedCount).toBe(1)
    expect(outcome.clone).not.toBeNull()
    expect(getBlockPlainText(outcome.clone as HTMLElement)).toBe('插件部署指南')
  })

  it('keeps readonly block text non-replaceable when no editable root exists', () => {
    const block = createBlockFromHtml('<div contenteditable="false">本馆创编学生国学丛书</div>')

    expect(isRangeReplaceable(block, 6, 8)).toBe(false)
  })
})
