// @vitest-environment jsdom

import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  clearCachedEditorState,
  rememberEditorContext,
  rememberHintedEditorContext,
  resolveEditorContext,
} from '@/features/search-replace/store/context-cache'
import type { EditorContext } from '@/features/search-replace/types'

describe('editor context cache', () => {
  afterEach(() => {
    clearCachedEditorState()
    document.body.innerHTML = ''
  })

  it('prefers a reconnected visible context over a cached hinted transition context', () => {
    const transitionContext = createContext('root-1', 'Doc 1', 'protyle protyle--transition')
    const visibleContext = createContext('root-1', 'Doc 1', 'protyle protyle--visible')

    rememberHintedEditorContext(transitionContext)

    const resolved = resolveEditorContext({
      findEditorContextByRootId: vi.fn(() => visibleContext),
      getActiveEditorContext: vi.fn(() => visibleContext),
    })

    expect(resolved?.protyle).toBe(visibleContext.protyle)
  })

  it('prefers a reconnected visible context over a cached transition context when active lookup is unavailable', () => {
    const transitionContext = createContext('root-1', 'Doc 1', 'protyle protyle--transition')
    const visibleContext = createContext('root-1', 'Doc 1', 'protyle protyle--visible')

    rememberEditorContext(transitionContext)

    const resolved = resolveEditorContext({
      findEditorContextByRootId: vi.fn(() => visibleContext),
      getActiveEditorContext: vi.fn(() => null),
    })

    expect(resolved?.protyle).toBe(visibleContext.protyle)
  })

  it('prefers the active canvas context over a stale hinted protyle context', () => {
    const staleProtyleContext = createContext('root-1', 'Doc 1', 'protyle')
    const canvasContext = createContext('canvas:/data/a.canvas', 'a.canvas', 'siyuan-canvas__tab')
    canvasContext.sourceKind = 'canvas'

    rememberHintedEditorContext(staleProtyleContext)

    const resolved = resolveEditorContext({
      findEditorContextByRootId: vi.fn(() => staleProtyleContext),
      getActiveEditorContext: vi.fn(() => canvasContext),
    })

    expect(resolved).toBe(canvasContext)
  })
})

function createContext(rootId: string, title: string, className: string): EditorContext {
  const protyle = document.createElement('div')
  protyle.className = className
  document.body.appendChild(protyle)

  return {
    protyle,
    rootId,
    title,
  }
}
