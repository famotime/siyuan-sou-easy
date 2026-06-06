// @vitest-environment jsdom

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const surface = {
  clear: vi.fn(),
  focus: vi.fn(),
  goTo: vi.fn(),
  id: 'terminal-1',
  search: vi.fn(() => ({
    currentIndex: 0,
    error: '',
    matches: [
      {
        col: 0,
        id: '0:0:5',
        length: 5,
        matchedText: 'alpha',
        previewText: '[alpha]',
        row: 0,
      },
      {
        col: 6,
        id: '0:6:11',
        length: 5,
        matchedText: 'alpha',
        previewText: 'alpha [alpha]',
        row: 0,
      },
    ],
  })),
  title: 'AI Terminal',
}

vi.mock('@/features/search-replace/editor', () => ({
  applyReplacementsToClone: vi.fn(),
  createBlockElementFromDom: vi.fn(),
  getActiveEditorContext: vi.fn(() => null),
  getBlockElement: vi.fn(),
  getCurrentSelectionScope: vi.fn(() => new Map()),
  getCurrentSelectionText: vi.fn(() => ''),
  isMatchVisible: vi.fn(() => true),
  scrollMatchIntoView: vi.fn(),
}))

vi.mock('@/features/search-replace/kernel', () => ({
  getBlockDoms: vi.fn(),
  updateDomBlock: vi.fn(),
}))

import {
  closePanel,
  goNext,
  goPrev,
  openTerminalPanel,
  replaceAll,
  replaceCurrent,
  searchReplaceState,
  setQuery,
} from '@/features/search-replace/store'

describe('terminal search store mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    searchReplaceState.visible = false
    searchReplaceState.replaceVisible = false
    searchReplaceState.query = ''
    searchReplaceState.matches = []
    searchReplaceState.currentIndex = 0
    searchReplaceState.error = ''
    searchReplaceState.currentRootId = ''
    searchReplaceState.currentTitle = ''
    searchReplaceState.sourceMode = 'editor'
    searchReplaceState.terminalSurfaceId = undefined
  })

  it('opens terminal mode and searches through the active surface', () => {
    openTerminalPanel(surface as any, false)
    setQuery('alpha')

    expect(searchReplaceState.visible).toBe(true)
    expect(searchReplaceState.sourceMode).toBe('terminal')
    expect(searchReplaceState.currentRootId).toBe('terminal-1')
    expect(searchReplaceState.currentTitle).toBe('AI Terminal')
    expect(surface.search).toHaveBeenCalledWith({
      matchCase: false,
      query: 'alpha',
      useRegex: false,
      wholeWord: false,
    })
    expect(searchReplaceState.matches).toHaveLength(2)
  })

  it('navigates terminal matches through the active surface', () => {
    openTerminalPanel(surface as any, false)
    setQuery('alpha')

    goNext()
    expect(searchReplaceState.currentIndex).toBe(1)
    expect(surface.goTo).toHaveBeenCalledWith(1)

    goPrev()
    expect(searchReplaceState.currentIndex).toBe(0)
    expect(surface.goTo).toHaveBeenCalledWith(0)
  })

  it('clears terminal highlights when closing the panel', () => {
    openTerminalPanel(surface as any, false)
    closePanel()

    expect(surface.clear).toHaveBeenCalled()
    expect(searchReplaceState.sourceMode).toBe('editor')
  })

  it('does not replace terminal matches', async () => {
    openTerminalPanel(surface as any, true)
    setQuery('alpha')

    await replaceCurrent()
    await replaceAll()

    expect(searchReplaceState.matches[0]?.replaceable).toBe(false)
  })
})
