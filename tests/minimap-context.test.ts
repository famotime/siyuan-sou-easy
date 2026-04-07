// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  resolveMinimapContext,
  resolveMinimapScrollContainer,
} from '@/features/search-replace/ui/minimap-context'

describe('minimap context helpers', () => {
  it('falls back to the active editor when the current root is missing', () => {
    const activeContext = {
      protyle: document.createElement('div'),
      rootId: 'active-root',
      title: 'Active Doc',
    }

    const context = resolveMinimapContext({
      currentRootId: 'missing-root',
      currentTitle: 'Missing Doc',
      findEditorContextByRootId: () => null,
      getActiveEditorContext: () => activeContext,
    })

    expect(context).toBe(activeContext)
  })

  it('prefers the resolved root context when it exists', () => {
    const resolvedContext = {
      protyle: document.createElement('div'),
      rootId: 'root-1',
      title: 'Doc 1',
    }

    const context = resolveMinimapContext({
      currentRootId: 'root-1',
      currentTitle: 'Doc 1',
      findEditorContextByRootId: () => resolvedContext,
      getActiveEditorContext: () => null,
    })

    expect(context).toBe(resolvedContext)
  })

  it('chooses protyle-content first, then wysiwyg, then the protyle root', () => {
    const protyle = document.createElement('div')
    const content = document.createElement('div')
    content.className = 'protyle-content'
    const wysiwyg = document.createElement('div')
    wysiwyg.className = 'protyle-wysiwyg'
    protyle.append(content, wysiwyg)

    expect(resolveMinimapScrollContainer({
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    })).toBe(content)

    content.remove()
    expect(resolveMinimapScrollContainer({
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    })).toBe(wysiwyg)

    wysiwyg.remove()
    expect(resolveMinimapScrollContainer({
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    })).toBe(protyle)
  })
})
