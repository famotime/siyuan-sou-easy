// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getTerminalSearchRegistry,
  isTerminalSearchTarget,
} from '@/features/search-replace/terminal/registry'
import { mapTerminalSearchResult } from '@/features/search-replace/terminal/adapter'

describe('terminal search registry adapter', () => {
  beforeEach(() => {
    delete (window as any).__SIYUAN_TERMINAL_SEARCH__
  })

  it('returns null when terminal registry is missing or has wrong version', () => {
    expect(getTerminalSearchRegistry()).toBeNull()
    ;(window as any).__SIYUAN_TERMINAL_SEARCH__ = { version: 2 }
    expect(getTerminalSearchRegistry()).toBeNull()
  })

  it('returns the version 1 registry', () => {
    const registry = {
      getActiveSurface: vi.fn(),
      listSurfaces: vi.fn(),
      subscribe: vi.fn(),
      version: 1,
    }
    ;(window as any).__SIYUAN_TERMINAL_SEARCH__ = registry

    expect(getTerminalSearchRegistry()).toBe(registry)
  })

  it('detects terminal DOM targets', () => {
    document.body.innerHTML = `<div class="ai-term-tab-container"><div class="ai-term-terminal"><button id="target"></button></div></div>`

    expect(isTerminalSearchTarget(document.getElementById('target'))).toBe(true)
    expect(isTerminalSearchTarget(document.body)).toBe(false)
  })

  it('maps terminal matches into readonly SearchMatch objects', () => {
    const result = mapTerminalSearchResult({
      currentIndex: 0,
      error: '',
      matches: [{
        col: 6,
        id: '0:6:11',
        length: 5,
        matchedText: 'hello',
        previewText: 'say [hello]',
        row: 0,
      }],
    }, 'terminal-1')

    expect(result.matches).toEqual([
      expect.objectContaining({
        blockId: 'terminal-1:0',
        blockIndex: 0,
        blockType: 'TerminalRow',
        end: 11,
        matchedText: 'hello',
        replaceable: false,
        rootId: 'terminal-1',
        sourceKind: 'terminal',
        start: 6,
      }),
    ])
  })
})
