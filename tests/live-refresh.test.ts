import type {
  SearchableBlock,
  SearchMatch,
  SearchOptions,
  SelectionScope,
} from '@/features/search-replace/types'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  applyPluginSettings,
  closePanel,
  openPanel,
  searchReplaceState,
} from '@/features/search-replace/store'

import {
  DEFAULT_SETTINGS,
} from '@/settings'
import { resetState } from './helpers/store-state'

const editorMocks = vi.hoisted(() => {
  const state = {
    blocks: [] as Array<{
      blockId: string
      blockIndex: number
      blockType: string
      element: HTMLElement
      rootId: string
      text: string
    }>,
    context: null as null | {
      protyle: HTMLElement
      rootId: string
      title: string
    },
    contextAvailable: true,
  }

  return {
    state,
    applyReplacementsToClone: vi.fn(),
    clearSearchDecorations: vi.fn(),
    collectSearchableBlocks: vi.fn(() => state.blocks),
    createBlockElementFromDom: vi.fn(),
    findEditorContextByRootId: vi.fn(() => (state.contextAvailable ? state.context : null)),
    getActiveEditorContext: vi.fn(() => (state.contextAvailable ? state.context : null)),
    getBlockElement: vi.fn(),
    getCurrentSelectionScope: vi.fn(() => new Map()),
    getCurrentSelectionText: vi.fn(() => ''),
    isMatchVisible: vi.fn(() => true),
    scrollMatchIntoView: vi.fn(),
    syncSearchDecorations: vi.fn(),
  }
})

const searchEngineMocks = vi.hoisted(() => ({
  // 按 findMatches 真实签名补参（参数仅用于类型，不改变默认返回值），使后续 mockImplementation 可携带参数
  findMatches: vi.fn(
    (_blocks: SearchableBlock[], _query: string, _options: SearchOptions, _selectionScope: SelectionScope): { error: string, matches: SearchMatch[] } => ({
      error: '',
      matches: [],
    }),
  ),
}))

vi.mock('@/features/search-replace/editor', () => editorMocks)
vi.mock('@/features/search-replace/search-engine', () => searchEngineMocks)

describe('search store live refresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    document.body.innerHTML = ''

    const protyle = document.createElement('div')
    protyle.className = 'protyle'

    const wysiwyg = document.createElement('div')
    wysiwyg.className = 'protyle-wysiwyg'
    protyle.appendChild(wysiwyg)
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
      element: wysiwyg,
      rootId: 'root-1',
      text: 'bar baz',
    }]

    resetState()
  })

  afterEach(async () => {
    closePanel()
    await vi.runOnlyPendingTimersAsync()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('does not jump back to the current match during passive refreshes', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })
    searchReplaceState.query = 'foo'

    searchEngineMocks.findMatches.mockImplementation(() => ({
      error: '',
      matches: [{
        blockId: 'block-1',
        blockIndex: 0,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-1:0:3',
        matchedText: 'foo',
        previewText: '[foo] bar',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
        occ: 0,
      }],
    }))

    openPanel(true)
    await flushRefresh()

    editorMocks.scrollMatchIntoView.mockClear()
    editorMocks.syncSearchDecorations.mockClear()

    const changedNode = document.createElement('div')
    changedNode.textContent = 'foo bar'
    editorMocks.state.context!.protyle.querySelector('.protyle-wysiwyg')?.appendChild(changedNode)

    await Promise.resolve()
    await flushRefresh()

    expect(editorMocks.syncSearchDecorations).toHaveBeenCalledTimes(1)
    expect(editorMocks.scrollMatchIntoView).not.toHaveBeenCalled()
  })

  it('refreshes matches when the current document DOM changes', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })
    searchReplaceState.query = 'foo'

    searchEngineMocks.findMatches
      .mockImplementationOnce(() => ({
        error: '',
        matches: [],
      }))
      .mockImplementationOnce(() => ({
        error: '',
        matches: [{
          blockId: 'block-1',
          blockIndex: 0,
          blockType: 'NodeParagraph',
          end: 3,
          id: 'block-1:0:3',
          matchedText: 'foo',
          previewText: '[foo] bar',
          replaceable: true,
          rootId: 'root-1',
          start: 0,
          occ: 0,
        }],
      }))

    openPanel(true)
    await flushRefresh()

    expect(searchReplaceState.matches).toHaveLength(0)
    expect(searchEngineMocks.findMatches).toHaveBeenCalledTimes(1)

    editorMocks.state.blocks = [{
      blockId: 'block-1',
      blockIndex: 0,
      blockType: 'NodeParagraph',
      element: editorMocks.state.context!.protyle.querySelector('.protyle-wysiwyg') as HTMLElement,
      rootId: 'root-1',
      text: 'foo bar',
    }]

    const changedNode = document.createElement('div')
    changedNode.textContent = 'foo bar'
    editorMocks.state.context!.protyle.querySelector('.protyle-wysiwyg')?.appendChild(changedNode)

    await Promise.resolve()
    await flushRefresh()

    expect(searchEngineMocks.findMatches).toHaveBeenCalledTimes(2)
    expect(searchReplaceState.matches).toHaveLength(1)
  })

  it('preserves in-block match order after refresh merges and sorts results', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })
    searchReplaceState.query = '文'

    searchEngineMocks.findMatches.mockImplementation(() => ({
      error: '',
      matches: [
        {
          blockId: 'block-1',
          blockIndex: 0,
          blockType: 'NodeParagraph',
          end: 3,
          id: 'block-1:2:3',
          matchedText: '文',
          previewText: '三、全书白[文]四十七万余字',
          replaceable: true,
          rootId: 'root-1',
          start: 2,
          occ: 0,
        },
        {
          blockId: 'block-1',
          blockIndex: 0,
          blockType: 'NodeParagraph',
          end: 11,
          id: 'block-1:10:11',
          matchedText: '文',
          previewText: '合计白[文]连注译约为',
          replaceable: true,
          rootId: 'root-1',
          start: 10,
          occ: 0,
        },
      ],
    }))

    openPanel(true)
    await flushRefresh()

    expect(searchReplaceState.matches.map((match) => match.start)).toEqual([2, 10])
  })

  it('invalidates the cached selection scope when the document changes without an active selection', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })
    searchReplaceState.query = 'foo'
    searchReplaceState.options.selectionOnly = true

    const selectionScope = new Map([
      ['block-1', [{
        start: 0,
        end: 3,
        occ: 0,
      }]],
    ])

    editorMocks.getCurrentSelectionScope
      .mockImplementationOnce(() => selectionScope)
      .mockImplementation(() => new Map())
    searchEngineMocks.findMatches.mockImplementation((blocks, _query, _options, scope) => {
      if (blocks.length === 0) {
        return {
          error: '',
          matches: [],
        }
      }

      return {
        error: '',
        matches: scope?.size
          ? [{
              blockId: 'block-1',
              blockIndex: 0,
              blockType: 'NodeParagraph',
              end: 3,
              id: 'block-1:0:3',
              matchedText: 'foo',
              previewText: '[foo] bar',
              replaceable: true,
              rootId: 'root-1',
              start: 0,
              occ: 0,
            }]
          : [],
      }
    })

    openPanel(true)
    await flushRefresh()

    expect(searchReplaceState.matches).toHaveLength(1)

    const changedNode = document.createElement('div')
    changedNode.textContent = 'foo bar'
    editorMocks.state.context!.protyle.querySelector('.protyle-wysiwyg')?.appendChild(changedNode)

    await Promise.resolve()
    await flushRefresh()

    expect(searchReplaceState.matches).toEqual([])
    expect(searchReplaceState.error).toBe('选区模式已开启，但当前没有可用选区')
  })
})

async function flushRefresh() {
  await vi.runOnlyPendingTimersAsync()
}

