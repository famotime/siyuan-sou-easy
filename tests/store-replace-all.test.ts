// @vitest-environment jsdom

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import * as siyuan from 'siyuan'
import { DEFAULT_SETTINGS, createSearchOptionsFromSettings } from '@/settings'

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
    context: {
      protyle: { isConnected: true } as HTMLElement,
      rootId: 'root-1',
      title: 'Doc 1',
    },
    contextAvailable: true,
  }

  return {
    state,
    applyReplacementsToClone: vi.fn(),
    buildPreview: vi.fn((text: string, start: number, end: number) => `${text.slice(0, start)}[${text.slice(start, end)}]${text.slice(end)}`),
    clearSearchDecorations: vi.fn(),
    collectSearchableBlocks: vi.fn(() => state.blocks),
    createBlockElementFromDom: vi.fn((dom: string) => {
      const container = document.createElement('div')
      container.innerHTML = dom
      return container.firstElementChild as HTMLElement | null
    }),
    createEditorContextFromElement: vi.fn(() => state.context),
    findEditorContextByRootId: vi.fn(() => (state.contextAvailable ? state.context : null)),
    getActiveEditorContext: vi.fn(() => (state.contextAvailable ? state.context : null)),
    getBlockElement: vi.fn(),
    getCurrentSelectionScope: vi.fn(() => new Map()),
    getCurrentSelectionText: vi.fn(() => ''),
    isMatchVisible: vi.fn(() => true),
    getUniqueBlockElements: vi.fn((root: ParentNode) => Array.from(root.querySelectorAll<HTMLElement>('[data-node-id][data-type]'))),
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
  getAttributeViewKeysByAvID: vi.fn(async () => []),
  getBlockAttrs: vi.fn(async () => ({})),
  getBlockDoms: vi.fn(async () => ({})),
  getDocumentContent: vi.fn(async () => ({
    blockCount: 0,
    content: '',
    eof: true,
  })),
  renderAttributeView: vi.fn(async () => null),
  updateDomBlock: vi.fn(async () => null),
}))

vi.mock('@/features/search-replace/editor', () => editorMocks)
vi.mock('@/features/search-replace/search-engine', () => searchEngineMocks)
vi.mock('@/features/search-replace/kernel', () => kernelMocks)

import {
  applyPluginSettings,
  closePanel,
  replaceAll,
  searchReplaceState,
} from '@/features/search-replace/store'

describe('search store replaceAll', () => {
  beforeEach(() => {
    resetState()
    vi.clearAllMocks()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    editorMocks.state.blocks = [
      {
        blockId: 'block-1',
        blockIndex: 0,
        blockType: 'NodeParagraph',
        element: {} as HTMLElement,
        rootId: 'root-1',
        text: 'foo foo',
      },
      {
        blockId: 'block-2',
        blockIndex: 1,
        blockType: 'NodeParagraph',
        element: {} as HTMLElement,
        rootId: 'root-1',
        text: 'foo',
      },
    ]
    editorMocks.state.context = {
      protyle: { isConnected: true } as HTMLElement,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.state.contextAvailable = true
    editorMocks.findEditorContextByRootId.mockImplementation(() => (editorMocks.state.contextAvailable ? editorMocks.state.context : null))
    editorMocks.getActiveEditorContext.mockImplementation(() => (editorMocks.state.contextAvailable ? editorMocks.state.context : null))

    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
      searchAttributeView: false,
    })
  })

  afterEach(() => {
    closePanel()
    vi.restoreAllMocks()
  })

  it('groups matches by block, updates replaceable blocks, and reports skipped matches', async () => {
    searchReplaceState.visible = true
    searchReplaceState.query = 'foo'
    searchReplaceState.replacement = 'bar'
    searchReplaceState.matches = [
      {
        blockId: 'block-1',
        blockIndex: 0,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-1:0:3',
        matchedText: 'foo',
        previewText: '[foo] foo',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
      },
      {
        blockId: 'block-1',
        blockIndex: 0,
        blockType: 'NodeParagraph',
        end: 7,
        id: 'block-1:4:7',
        matchedText: 'foo',
        previewText: 'foo [foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 4,
      },
      {
        blockId: 'block-2',
        blockIndex: 1,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-2:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
      },
      {
        blockId: 'block-ignored',
        blockIndex: 2,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-ignored:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-other',
        start: 0,
      },
    ]

    editorMocks.getBlockElement.mockImplementation((_context, blockId: string) => {
      if (blockId === 'block-1' || blockId === 'block-2') {
        return { dataset: { nodeId: blockId } } as HTMLElement
      }

      return null
    })
    editorMocks.applyReplacementsToClone.mockImplementation((_blockElement: HTMLElement, matches: Array<{ blockId: string }>) => {
      if (matches[0]?.blockId === 'block-1') {
        return {
          appliedCount: 2,
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

    await replaceAll()

    expect(window.confirm).toHaveBeenCalledWith('确定替换当前文档内的 4 处命中吗？')
    expect(editorMocks.applyReplacementsToClone).toHaveBeenCalledTimes(2)
    expect(kernelMocks.updateDomBlock).toHaveBeenCalledTimes(1)
    expect(kernelMocks.updateDomBlock).toHaveBeenCalledWith(
      'block-1',
      '<div data-node-id="block-1">bar bar</div>',
    )
    expect(searchEngineMocks.findMatches).toHaveBeenCalledTimes(1)
    expect(searchReplaceState.matches).toEqual([])
    expect(siyuan.showMessage).toHaveBeenCalledWith('替换完成：2 处，跳过 1 处', 4000, 'info')
  })

  it('aborts without touching blocks when the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    searchReplaceState.matches = [{
      blockId: 'block-1',
      blockIndex: 0,
      blockType: 'NodeParagraph',
      end: 3,
      id: 'block-1:0:3',
      matchedText: 'foo',
      previewText: '[foo]',
      replaceable: true,
      rootId: 'root-1',
      start: 0,
    }]

    await replaceAll()

    expect(editorMocks.getBlockElement).not.toHaveBeenCalled()
    expect(kernelMocks.updateDomBlock).not.toHaveBeenCalled()
    expect(searchEngineMocks.findMatches).not.toHaveBeenCalled()
  })

  it('fetches DOM for unloaded blocks so replace-all still covers the whole document', async () => {
    searchReplaceState.visible = true
    searchReplaceState.query = 'foo'
    searchReplaceState.replacement = 'bar'
    searchReplaceState.matches = [
      {
        blockId: 'block-1',
        blockIndex: 0,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-1:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
      },
      {
        blockId: 'block-2',
        blockIndex: 1,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-2:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
      },
    ]

    editorMocks.getBlockElement.mockImplementation((_context, blockId: string) => {
      if (blockId === 'block-1') {
        return {
          dataset: {
            nodeId: blockId,
          },
        } as HTMLElement
      }

      return null
    })
    kernelMocks.getBlockDoms.mockResolvedValue({
      'block-2': '<div data-node-id="block-2" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>',
    })
    editorMocks.applyReplacementsToClone.mockImplementation((blockElement: HTMLElement, matches: Array<{ blockId: string }>) => ({
      appliedCount: matches.length,
      clone: {
        outerHTML: `<div data-node-id="${blockElement.dataset.nodeId}" data-type="NodeParagraph"><div contenteditable="true">bar</div></div>`,
      },
    }))

    await replaceAll()

    expect(kernelMocks.getBlockDoms).toHaveBeenCalledWith(['block-2'])
    expect(kernelMocks.updateDomBlock).toHaveBeenCalledTimes(2)
    expect(kernelMocks.updateDomBlock).toHaveBeenNthCalledWith(
      1,
      'block-1',
      '<div data-node-id="block-1" data-type="NodeParagraph"><div contenteditable="true">bar</div></div>',
    )
    expect(kernelMocks.updateDomBlock).toHaveBeenNthCalledWith(
      2,
      'block-2',
      '<div data-node-id="block-2" data-type="NodeParagraph"><div contenteditable="true">bar</div></div>',
    )
  })

  it('uses the runtime preserve-case toggle instead of plugin settings during replacement', async () => {
    searchReplaceState.visible = true
    searchReplaceState.query = 'foo'
    searchReplaceState.replacement = 'bar'
    searchReplaceState.preserveCase = true
    searchReplaceState.settings.preserveCase = false as any
    searchReplaceState.matches = [{
      blockId: 'block-1',
      blockIndex: 0,
      blockType: 'NodeParagraph',
      end: 3,
      id: 'block-1:0:3',
      matchedText: 'FOO',
      previewText: '[FOO]',
      replaceable: true,
      rootId: 'root-1',
      start: 0,
    }]

    editorMocks.getBlockElement.mockReturnValue({
      dataset: { nodeId: 'block-1' },
    } as HTMLElement)
    editorMocks.applyReplacementsToClone.mockReturnValue({
      appliedCount: 1,
      clone: {
        outerHTML: '<div data-node-id="block-1">BAR</div>',
      },
    })

    await replaceAll()

    expect(editorMocks.applyReplacementsToClone).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'bar',
      { preserveCase: true },
    )
  })

  it('does not replace anything when the current result set contains attribute view matches', async () => {
    searchReplaceState.visible = true
    searchReplaceState.query = '热辣滚烫'
    searchReplaceState.replacement = '你好，李焕英'
    searchReplaceState.matches = [{
      attributeView: {
        avBlockId: 'av-block-1',
        avID: 'av-1',
        columnName: '电影',
        itemID: 'item-1',
        keyID: 'col-1',
      },
      blockId: 'av-block-1',
      blockIndex: 0,
      blockType: 'NodeAttributeView',
      end: 4,
      id: 'av:av-block-1:item-1:col-1:0:4',
      matchedText: '热辣滚烫',
      previewText: '电影: [热辣滚烫]',
      replaceable: false,
      rootId: 'root-1',
      sourceKind: 'attribute-view',
      start: 0,
    }]

    await replaceAll()

    expect(window.confirm).not.toHaveBeenCalled()
    expect(editorMocks.getBlockElement).not.toHaveBeenCalled()
    expect(kernelMocks.updateDomBlock).not.toHaveBeenCalled()
    expect(searchEngineMocks.findMatches).not.toHaveBeenCalled()
    expect(siyuan.showMessage).toHaveBeenCalled()
  })
})

function resetState() {
  searchReplaceState.visible = false
  searchReplaceState.replaceVisible = DEFAULT_SETTINGS.defaultReplaceVisible
  searchReplaceState.minimapVisible = false
  searchReplaceState.preserveCase = false
  searchReplaceState.panelPosition = null
  searchReplaceState.settings = { ...DEFAULT_SETTINGS }
  searchReplaceState.query = ''
  searchReplaceState.replacement = ''
  searchReplaceState.options = createSearchOptionsFromSettings(DEFAULT_SETTINGS)
  searchReplaceState.currentRootId = ''
  searchReplaceState.currentTitle = ''
  searchReplaceState.navigationHint = ''
  searchReplaceState.minimapBlocks = []
  searchReplaceState.matches = []
  searchReplaceState.currentIndex = 0
  searchReplaceState.error = ''
  searchReplaceState.busy = false
  searchReplaceState.searchableBlockCount = 0
}
