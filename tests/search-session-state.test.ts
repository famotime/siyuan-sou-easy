import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  applyClosePanelState,
  applyOpenPanelState,
  clearQueryEditState,
  resolveNextPanelVisibility,
} from '@/features/search-replace/store/search-session-state'

describe('search session state helpers', () => {
  it('resolves panel visibility from explicit commands or toggle behavior', () => {
    expect(resolveNextPanelVisibility(false, true)).toBe(true)
    expect(resolveNextPanelVisibility(true, false)).toBe(false)
    expect(resolveNextPanelVisibility(false)).toBe(true)
    expect(resolveNextPanelVisibility(true)).toBe(false)
  })

  it('applies the requested replace mode or falls back to the default setting', () => {
    const state = {
      replaceVisible: false,
      settings: {
        defaultReplaceVisible: true,
      },
    }

    applyOpenPanelState(state, false)
    expect(state.replaceVisible).toBe(false)

    applyOpenPanelState(state)
    expect(state.replaceVisible).toBe(true)
  })

  it('clears transient panel state when closing the panel', () => {
    const state = {
      busy: true,
      error: 'boom',
      minimapBlocks: [{ blockId: 'block-1' }],
      navigationHint: 'pending',
      searchableBlockCount: 3,
      searching: true,
      visible: true,
    }

    applyClosePanelState(state)

    expect(state).toMatchObject({
      busy: false,
      error: '',
      minimapBlocks: [],
      navigationHint: '',
      searchableBlockCount: 0,
      searching: false,
      visible: false,
    })
  })

  it('clears query results immediately and preserves the pending index only when the next query is non-empty', () => {
    const state = {
      currentIndex: 2,
      error: 'old',
      matches: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      minimapBlocks: [{ blockId: 'block-1' }],
      navigationHint: 'pending',
      query: 'fo',
      searchableBlockCount: 1,
      searching: true,
      visible: true,
    }

    expect(clearQueryEditState(state)).toBe(2)
    expect(state.matches).toEqual([])
    expect(state.minimapBlocks).toEqual([])
    expect(state.searchableBlockCount).toBe(0)
    expect(state.navigationHint).toBe('')
    expect(state.error).toBe('')

    state.currentIndex = 2
    state.query = '   '
    state.matches = [{ id: 'a' }]

    expect(clearQueryEditState(state)).toBeNull()
    expect(state.currentIndex).toBe(0)
  })
})
