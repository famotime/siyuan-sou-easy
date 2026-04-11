// @vitest-environment jsdom

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { showMessage } from 'siyuan'
import { DEFAULT_SETTINGS, createSearchOptionsFromSettings } from '@/settings'

const editorMocks = vi.hoisted(() => {
  const state = {
    blocks: [{
      blockId: 'block-1',
      blockIndex: 0,
      blockType: 'NodeParagraph',
      element: {} as HTMLElement,
      rootId: 'root-1',
      text: 'foo bar foo',
    }],
    context: {
      protyle: document.createElement('div'),
      rootId: 'root-1',
      title: 'Doc 1',
    },
    contextAvailable: true,
  }

  return {
    state,
    applyReplacementsToClone: vi.fn(),
    clearSearchDecorations: vi.fn(),
    collectSearchableBlocks: vi.fn(() => state.blocks),
    createEditorContextFromElement: vi.fn(() => state.context),
    findEditorContextByRootId: vi.fn(() => (state.contextAvailable ? state.context : null)),
    getActiveEditorContext: vi.fn(() => (state.contextAvailable ? state.context : null)),
    getBlockElement: vi.fn(),
    getCurrentSelectionText: vi.fn(() => ''),
    scrollMatchIntoView: vi.fn(),
    syncSearchDecorations: vi.fn(),
  }
})

const searchEngineMocks = vi.hoisted(() => ({
  findMatches: vi.fn(() => ({
    error: '',
    matches: [],
  })),
}))

const kernelMocks = vi.hoisted(() => ({
  updateDomBlock: vi.fn(async () => null),
}))

vi.mock('@/features/search-replace/editor', () => editorMocks)
vi.mock('@/features/search-replace/search-engine', () => searchEngineMocks)
vi.mock('@/features/search-replace/kernel', () => kernelMocks)

import {
  applyPluginSettings,
  closePanel,
  onEditorContextChanged,
  openPanel,
  replaceAll,
  replaceCurrent,
  searchReplaceState,
  unbindPlugin,
} from '@/features/search-replace/store'

describe('search store actions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.stubGlobal('confirm', vi.fn(() => true))
    document.body.innerHTML = ''

    const protyle = document.createElement('div')
    protyle.className = 'protyle'
    document.body.appendChild(protyle)

    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.state.contextAvailable = true
    editorMocks.state.blocks = [{
      blockId: 'block-1',
      blockIndex: 0,
      blockType: 'NodeParagraph',
      element: protyle,
      rootId: 'root-1',
      text: 'foo bar foo',
    }]

    resetState()
  })

  afterEach(() => {
    closePanel()
    unbindPlugin()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('preloads the current selection only when query is empty and preloadSelection is enabled', () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: true,
    })
    editorMocks.getCurrentSelectionText.mockReturnValue('  foo  ')

    openPanel(true)

    expect(searchReplaceState.query).toBe('foo')

    closePanel()
    resetState()
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: true,
    })
    editorMocks.getCurrentSelectionText.mockReturnValue('  bar  ')
    searchReplaceState.query = 'keep-me'

    openPanel(true)

    expect(searchReplaceState.query).toBe('keep-me')
  })

  it('does not preload the selection when preloadSelection is disabled', () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })
    editorMocks.getCurrentSelectionText.mockReturnValue('  foo  ')

    openPanel(true)

    expect(searchReplaceState.query).toBe('')
  })

  it('clears busy state, error, and decorations when closing the panel', () => {
    searchReplaceState.visible = true
    searchReplaceState.busy = true
    searchReplaceState.error = 'Something went wrong'

    closePanel()

    expect(searchReplaceState.visible).toBe(false)
    expect(searchReplaceState.busy).toBe(false)
    expect(searchReplaceState.error).toBe('')
    expect(editorMocks.clearSearchDecorations).toHaveBeenCalledTimes(1)
  })

  it('groups replace-all updates by block and skips unreplaced matches', async () => {
    const blockElements = {
      'block-1': { outerHTML: '<div data-node-id="block-1"></div>' } as HTMLElement,
      'block-2': { outerHTML: '<div data-node-id="block-2"></div>' } as HTMLElement,
    }

    searchReplaceState.visible = true
    searchReplaceState.replacement = 'bar'
    searchReplaceState.matches = [
      createMatch('block-1', 0, 3),
      createMatch('block-1', 8, 11),
      createMatch('block-2', 0, 3),
    ]

    editorMocks.getBlockElement.mockImplementation((_, blockId: string) => blockElements[blockId as keyof typeof blockElements] ?? null)
    editorMocks.applyReplacementsToClone.mockImplementation((blockElement: HTMLElement, matches: Array<{ start: number }>) => {
      if (blockElement === blockElements['block-1']) {
        return {
          appliedCount: matches.length,
          clone: {
            outerHTML: '<div data-node-id="block-1">bar bar</div>',
          },
        }
      }

      return {
        appliedCount: 0,
        clone: null,
      }
    })

    onEditorContextChanged(editorMocks.state.context)
    await replaceAll()

    expect(editorMocks.applyReplacementsToClone).toHaveBeenCalledTimes(2)
    expect(editorMocks.applyReplacementsToClone).toHaveBeenNthCalledWith(
      1,
      blockElements['block-1'],
      expect.arrayContaining([
        expect.objectContaining({ blockId: 'block-1', start: 0 }),
        expect.objectContaining({ blockId: 'block-1', start: 8 }),
      ]),
      'bar',
      { preserveCase: false },
    )
    expect(editorMocks.applyReplacementsToClone).toHaveBeenNthCalledWith(
      2,
      blockElements['block-2'],
      [expect.objectContaining({ blockId: 'block-2', start: 0 })],
      'bar',
      { preserveCase: false },
    )
    expect(kernelMocks.updateDomBlock).toHaveBeenCalledTimes(1)
    expect(kernelMocks.updateDomBlock).toHaveBeenCalledWith(
      'block-1',
      '<div data-node-id="block-1">bar bar</div>',
    )
    expect(showMessage).toHaveBeenCalledTimes(1)
    expect(searchReplaceState.busy).toBe(false)
  })

  it('does not start replace-current or replace-all while busy', async () => {
    searchReplaceState.visible = true
    searchReplaceState.busy = true
    searchReplaceState.replacement = 'bar'
    searchReplaceState.matches = [createMatch('block-1', 0, 3)]

    await replaceCurrent()
    await replaceAll()

    expect(editorMocks.getBlockElement).not.toHaveBeenCalled()
    expect(editorMocks.applyReplacementsToClone).not.toHaveBeenCalled()
    expect(kernelMocks.updateDomBlock).not.toHaveBeenCalled()
  })
})

function createMatch(blockId: string, start: number, end: number) {
  return {
    blockId,
    blockIndex: 0,
    blockType: 'NodeParagraph',
    end,
    id: `${blockId}:${start}:${end}`,
    matchedText: 'foo',
    previewText: '[foo]',
    replaceable: true,
    rootId: 'root-1',
    start,
  }
}

function resetState() {
  searchReplaceState.visible = false
  searchReplaceState.replaceVisible = DEFAULT_SETTINGS.defaultReplaceVisible
  searchReplaceState.panelPosition = null
  searchReplaceState.settings = { ...DEFAULT_SETTINGS }
  searchReplaceState.query = ''
  searchReplaceState.replacement = ''
  searchReplaceState.options = createSearchOptionsFromSettings(DEFAULT_SETTINGS)
  searchReplaceState.currentRootId = ''
  searchReplaceState.currentTitle = ''
  searchReplaceState.matches = []
  searchReplaceState.currentIndex = 0
  searchReplaceState.error = ''
  searchReplaceState.busy = false
}
