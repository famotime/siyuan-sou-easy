// @vitest-environment jsdom

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

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
    collectSearchableBlocksFromDocumentContent: vi.fn((content: string, rootId: string) => {
      const container = document.createElement('div')
      container.innerHTML = content
      return Array.from(container.querySelectorAll<HTMLElement>('[data-node-id][data-type]'))
        .map((element, blockIndex) => ({
          blockId: element.dataset.nodeId ?? `block-${blockIndex}`,
          blockIndex,
          blockType: element.dataset.type ?? 'NodeParagraph',
          element,
          rootId,
          text: element.textContent ?? '',
        }))
        .filter(block => Boolean(block.text))
    }),
    createBlockElementFromDom: vi.fn(),
    findEditorContextByRootId: vi.fn(() => (state.contextAvailable ? state.context : null)),
    getActiveEditorContext: vi.fn(() => (state.contextAvailable ? state.context : null)),
    getBlockElement: vi.fn(),
    getCurrentSelectionScope: vi.fn(() => new Map()),
    getCurrentSelectionText: vi.fn(() => ''),
    getUniqueBlockElements: vi.fn((root: ParentNode) => Array.from(root.querySelectorAll<HTMLElement>('[data-node-id][data-type]'))),
    scrollMatchIntoView: vi.fn(),
    syncSearchDecorations: vi.fn(),
  }
})

const searchEngineMocks = vi.hoisted(() => ({
  findMatches: vi.fn(() => ({
    error: '',
    matches: [
      {
        blockId: 'block-1',
        blockIndex: 0,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-1:0:3',
        matchedText: 'foo',
        previewText: '[foo] bar foo',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
      },
      {
        blockId: 'block-1',
        blockIndex: 0,
        blockType: 'NodeParagraph',
        end: 11,
        id: 'block-1:8:11',
        matchedText: 'foo',
        previewText: 'foo bar [foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 8,
      },
    ],
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
  goNext,
  onEditorContextChanged,
  openPanel,
  replaceCurrent,
  searchReplaceState,
} from '@/features/search-replace/store'

describe('search store editor context fallback', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetState()
    editorMocks.state.blocks = [{
      blockId: 'block-1',
      blockIndex: 0,
      blockType: 'NodeParagraph',
      element: {} as HTMLElement,
      rootId: 'root-1',
      text: 'foo bar foo',
    }]
    editorMocks.state.context = {
      protyle: { isConnected: true } as HTMLElement,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.state.contextAvailable = true
    vi.clearAllMocks()
    editorMocks.collectSearchableBlocks.mockImplementation(() => editorMocks.state.blocks)
    editorMocks.findEditorContextByRootId.mockImplementation(() => (editorMocks.state.contextAvailable ? editorMocks.state.context : null))
    editorMocks.getActiveEditorContext.mockImplementation(() => (editorMocks.state.contextAvailable ? editorMocks.state.context : null))
    editorMocks.getCurrentSelectionScope.mockImplementation(() => new Map())
    searchEngineMocks.findMatches.mockImplementation(() => ({
      error: '',
      matches: [
        {
          blockId: 'block-1',
          blockIndex: 0,
          blockType: 'NodeParagraph',
          end: 3,
          id: 'block-1:0:3',
          matchedText: 'foo',
          previewText: '[foo] bar foo',
          replaceable: true,
          rootId: 'root-1',
          start: 0,
        },
        {
          blockId: 'block-1',
          blockIndex: 0,
          blockType: 'NodeParagraph',
          end: 11,
          id: 'block-1:8:11',
          matchedText: 'foo',
          previewText: 'foo bar [foo]',
          replaceable: true,
          rootId: 'root-1',
          start: 8,
        },
      ],
    }))
  })

  afterEach(async () => {
    closePanel()
    await vi.runOnlyPendingTimersAsync()
    vi.useRealTimers()
  })

  it('keeps searching after the panel steals focus from the editor', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })
    searchReplaceState.query = 'foo'

    openPanel(true)
    queueMicrotask(() => {
      editorMocks.state.contextAvailable = false
    })

    await Promise.resolve()
    await flushRefresh()

    expect(searchReplaceState.currentRootId).toBe('root-1')
    expect(searchReplaceState.currentTitle).toBe('Doc 1')
    expect(searchReplaceState.error).toBe('')
    expect(searchReplaceState.matches).toHaveLength(2)
  })

  it('keeps revealing matches when navigation runs from the panel', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })
    searchReplaceState.query = 'foo'

    openPanel(true)
    await flushRefresh()

    expect(searchReplaceState.matches).toHaveLength(2)

    editorMocks.state.contextAvailable = false
    editorMocks.scrollMatchIntoView.mockClear()
    editorMocks.syncSearchDecorations.mockClear()

    goNext()

    expect(searchReplaceState.currentIndex).toBe(1)
    expect(editorMocks.syncSearchDecorations).toHaveBeenCalledTimes(1)
    expect(editorMocks.scrollMatchIntoView).toHaveBeenCalledTimes(1)
  })

  it('can search immediately after opening when editor context was cached before the panel became visible', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })
    searchReplaceState.query = 'foo'
    editorMocks.state.contextAvailable = false

    onEditorContextChanged(editorMocks.state.context)
    openPanel(true)
    await flushRefresh()

    expect(searchReplaceState.currentRootId).toBe('root-1')
    expect(searchReplaceState.currentTitle).toBe('Doc 1')
    expect(searchReplaceState.error).toBe('')
    expect(searchReplaceState.matches).toHaveLength(2)
  })

  it('does not overwrite a cached editor event context with a stale detected context when opening the panel', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })

    const currentContext = {
      protyle: { isConnected: true } as HTMLElement,
      rootId: 'root-current',
      title: 'Current Doc',
    }
    const staleContext = {
      protyle: { isConnected: true } as HTMLElement,
      rootId: 'root-stale',
      title: 'Stale Doc',
    }

    editorMocks.collectSearchableBlocks.mockImplementation((context) => {
      if (context.rootId === currentContext.rootId) {
        return [{
          blockId: 'block-current',
          blockIndex: 0,
          blockType: 'NodeParagraph',
          element: {} as HTMLElement,
          rootId: currentContext.rootId,
          text: '问题问题',
        }]
      }

      return [{
        blockId: 'block-stale',
        blockIndex: 0,
        blockType: 'NodeParagraph',
        element: {} as HTMLElement,
        rootId: staleContext.rootId,
        text: 'other text',
      }]
    })
    searchEngineMocks.findMatches.mockImplementation((blocks) => ({
      error: '',
      matches: blocks[0]?.rootId === currentContext.rootId
        ? [{
          blockId: 'block-current',
          blockIndex: 0,
          blockType: 'NodeParagraph',
          end: 2,
          id: 'block-current:0:2',
          matchedText: '问题',
          previewText: '[问题]问题',
          replaceable: true,
          rootId: currentContext.rootId,
          start: 0,
        }]
        : [],
    }))

    searchReplaceState.query = '问题'
    editorMocks.state.context = staleContext

    onEditorContextChanged(currentContext)
    openPanel(true)
    await flushRefresh()

    expect(searchReplaceState.currentRootId).toBe(currentContext.rootId)
    expect(searchReplaceState.currentTitle).toBe(currentContext.title)
    expect(searchReplaceState.matches).toHaveLength(1)
    expect(searchReplaceState.matches[0]?.rootId).toBe(currentContext.rootId)
  })

  it('prefers the current selection text over the previous query when preload selection is enabled', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: true,
    })

    searchReplaceState.query = 'previous keyword'
    editorMocks.getCurrentSelectionText.mockReturnValue('selected keyword')

    openPanel(true)

    expect(searchReplaceState.query).toBe('selected keyword')
  })

  it('keeps the previous query when preload selection is enabled but there is no selection text', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: true,
    })

    searchReplaceState.query = 'previous keyword'
    editorMocks.getCurrentSelectionText.mockReturnValue('   ')

    openPanel(true)

    expect(searchReplaceState.query).toBe('previous keyword')
  })

  it('passes the current selection scope into search when selection-only mode is enabled', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })
    searchReplaceState.query = 'foo'
    ;(searchReplaceState.options as any).selectionOnly = true

    const selectionScope = new Map([
      ['block-1', [{ start: 4, end: 11 }]],
    ])
    editorMocks.getCurrentSelectionScope.mockReturnValue(selectionScope)

    openPanel(true)
    await flushRefresh()

    expect(editorMocks.getCurrentSelectionScope).toHaveBeenCalledWith(editorMocks.state.context)
    expect(searchEngineMocks.findMatches).toHaveBeenCalledWith(
      editorMocks.state.blocks,
      'foo',
      searchReplaceState.options,
      selectionScope,
    )
  })

  it('searches against the full document snapshot when the editor has only loaded part of the document', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })

    editorMocks.state.blocks = [{
      blockId: 'block-1',
      blockIndex: 0,
      blockType: 'NodeParagraph',
      element: {} as HTMLElement,
      rootId: 'root-1',
      text: 'foo',
    }]
    kernelMocks.getDocumentContent.mockResolvedValue({
      blockCount: 2,
      content: `
        <div class="protyle-wysiwyg">
          <div data-node-id="block-1" data-type="NodeParagraph">
            <div contenteditable="true">foo</div>
          </div>
          <div data-node-id="block-2" data-type="NodeParagraph">
            <div contenteditable="true">foo</div>
          </div>
        </div>
      `,
      eof: true,
    })
    searchEngineMocks.findMatches.mockImplementation((blocks) => ({
      error: '',
      matches: blocks.flatMap((block: any) => {
        const start = block.text.indexOf('foo')
        if (start < 0) {
          return []
        }

        return [{
          blockId: block.blockId,
          blockIndex: block.blockIndex,
          blockType: block.blockType,
          end: start + 3,
          id: `${block.blockId}:${start}:${start + 3}`,
          matchedText: 'foo',
          previewText: `[foo]`,
          replaceable: true,
          rootId: block.rootId,
          start,
        }]
      }),
    }))

    searchReplaceState.query = 'foo'

    openPanel(true)
    await flushRefresh()

    expect(kernelMocks.getDocumentContent).toHaveBeenLastCalledWith('root-1')
    const blocks = searchEngineMocks.findMatches.mock.calls.at(-1)?.[0] as Array<{ blockId: string }>
    expect(blocks.map(block => block.blockId)).toEqual(['block-1', 'block-2'])
    expect(searchReplaceState.matches).toHaveLength(2)
  })

  it('searches visible attribute view blocks through AV APIs and marks those matches as read-only', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
      searchAttributeView: true,
    })

    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="av-block-1" data-type="NodeAttributeView" data-av-id="av-1"></div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    editorMocks.state.blocks = []
    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    kernelMocks.getAttributeViewKeysByAvID.mockResolvedValue([
      {
        id: 'col-1',
        name: '电影',
      },
    ])
    kernelMocks.renderAttributeView.mockResolvedValue({
      view: {
        columns: [{
          id: 'col-1',
          name: '电影',
        }],
        rows: [{
          cells: [{
            keyID: 'col-1',
            value: {
              text: {
                content: '热辣滚烫',
              },
            },
          }],
          id: 'item-1',
        }],
      },
      viewType: 'table',
    })
    searchEngineMocks.findMatches.mockImplementation((blocks) => {
      const firstBlock = blocks[0]
      if (firstBlock?.blockType === 'NodeAttributeView') {
        return {
          error: '',
          matches: [{
            blockId: firstBlock.blockId,
            blockIndex: firstBlock.blockIndex,
            blockType: firstBlock.blockType,
            end: 4,
            id: `${firstBlock.blockId}:0:4`,
            matchedText: '热辣滚烫',
            previewText: '[热辣滚烫]',
            replaceable: true,
            rootId: firstBlock.rootId,
            start: 0,
          }],
        }
      }

      return {
        error: '',
        matches: [],
      }
    })

    searchReplaceState.query = '热辣滚烫'

    openPanel(true)
    await flushRefresh()

    expect(kernelMocks.getBlockAttrs).not.toHaveBeenCalled()
    expect(kernelMocks.getAttributeViewKeysByAvID).toHaveBeenCalledWith('av-1')
    expect(kernelMocks.renderAttributeView).toHaveBeenCalledWith('av-1')
    expect(searchReplaceState.matches).toHaveLength(1)
    expect(searchReplaceState.matches[0]).toMatchObject({
      blockId: 'av-block-1',
      replaceable: false,
      sourceKind: 'attribute-view',
    })
    expect(searchReplaceState.matches[0]?.attributeView).toMatchObject({
      avBlockId: 'av-block-1',
      avID: 'av-1',
      columnName: '电影',
      columnIndex: 0,
      keyID: 'col-1',
    })
    expect(searchReplaceState.matches[0]?.previewText).toContain('电影')
  })

  it('does not search attribute view blocks when the plugin setting is disabled', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
      searchAttributeView: false,
    })

    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="av-block-1" data-type="NodeAttributeView"></div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    editorMocks.state.blocks = []
    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    searchReplaceState.query = '热辣滚烫'

    openPanel(true)
    await flushRefresh()

    expect(kernelMocks.getBlockAttrs).not.toHaveBeenCalled()
    expect(kernelMocks.renderAttributeView).not.toHaveBeenCalled()
    expect(kernelMocks.getAttributeViewKeysByAvID).not.toHaveBeenCalled()
    expect(searchReplaceState.matches.some(match => match.sourceKind === 'attribute-view')).toBe(false)
  })

  it('searches unloaded attribute view blocks from the document snapshot when enabled', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
      searchAttributeView: true,
    })

    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="block-1" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    editorMocks.state.blocks = [{
      blockId: 'block-1',
      blockIndex: 0,
      blockType: 'NodeParagraph',
      element: document.querySelector<HTMLElement>('[data-node-id="block-1"]')!,
      rootId: 'root-1',
      text: 'foo',
    }]
    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    kernelMocks.getDocumentContent.mockResolvedValue({
      blockCount: 1,
      content: '<div class="protyle-wysiwyg"><div data-node-id="av-block-2" data-type="NodeAttributeView" data-av-id="av-2"></div></div>',
      eof: true,
    })
    kernelMocks.getAttributeViewKeysByAvID.mockResolvedValue([
      {
        id: 'col-1',
        name: '活动',
      },
    ])
    kernelMocks.renderAttributeView.mockResolvedValue({
      view: {
        columns: [{
          id: 'col-1',
          name: '活动',
        }],
        rows: [{
          cells: [{
            keyID: 'col-1',
            value: {
              text: {
                content: '年会',
              },
            },
          }],
          id: 'item-2',
        }],
      },
      viewType: 'table',
    })
    searchEngineMocks.findMatches.mockImplementation((blocks) => {
      const firstBlock = blocks[0]
      if (firstBlock?.blockType === 'NodeAttributeView') {
        return {
          error: '',
          matches: [{
            blockId: firstBlock.blockId,
            blockIndex: firstBlock.blockIndex,
            blockType: firstBlock.blockType,
            end: 2,
            id: `${firstBlock.blockId}:0:2`,
            matchedText: '年会',
            previewText: '[年会]',
            replaceable: true,
            rootId: firstBlock.rootId,
            start: 0,
          }],
        }
      }

      return {
        error: '',
        matches: [],
      }
    })
    searchReplaceState.query = '年会'

    openPanel(true)
    await flushRefresh()

    expect(kernelMocks.getBlockAttrs).not.toHaveBeenCalled()
    expect(kernelMocks.getAttributeViewKeysByAvID).toHaveBeenCalledWith('av-2')
    expect(kernelMocks.renderAttributeView).toHaveBeenCalledWith('av-2')
    expect(searchReplaceState.matches).toHaveLength(1)
    expect(searchReplaceState.matches[0]).toMatchObject({
      blockId: 'av-block-2',
      previewText: expect.stringContaining('年会'),
      sourceKind: 'attribute-view',
    })
    expect(searchReplaceState.matches[0]?.attributeView).toMatchObject({
      columnName: '活动',
      columnIndex: 0,
      keyID: 'col-1',
    })
  })

  it('keeps navigating toward unloaded long-document matches and shows a loading hint until the target block is available', async () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="block-1" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    let scrollTop = 0
    let targetLoaded = false

    Object.defineProperty(scrollContainer, 'clientHeight', {
      configurable: true,
      value: 300,
    })
    Object.defineProperty(scrollContainer, 'scrollHeight', {
      configurable: true,
      value: 1200,
    })
    Object.defineProperty(scrollContainer, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value
      },
    })
    scrollContainer.scrollTo = vi.fn(({ top }: { top?: number }) => {
      scrollTop = top ?? scrollTop
    }) as any

    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match) => {
      if (match?.id === 'block-8:0:3') {
        return targetLoaded ? 'scrolled' : 'missing'
      }

      return 'visible'
    })

    searchReplaceState.visible = true
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
        blockId: 'block-8',
        blockIndex: 7,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-8:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
      },
    ]
    searchReplaceState.currentIndex = 0
    searchReplaceState.searchableBlockCount = 10
    searchReplaceState.minimapBlocks = Array.from({ length: 10 }, (_, index) => ({
      blockId: `block-${index + 1}`,
      blockIndex: index,
      blockType: 'NodeParagraph',
    }))

    goNext()

    expect(searchReplaceState.currentIndex).toBe(1)
    expect(searchReplaceState.navigationHint).toContain('等待内容加载')
    expect(scrollContainer.scrollTo).toHaveBeenCalled()
    expect(scrollTop).toBeGreaterThan(0)

    targetLoaded = true
    await vi.runOnlyPendingTimersAsync()

    expect(searchReplaceState.navigationHint).toBe('')
  })

  it('replaces the current match even when the panel has taken focus from the editor', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })
    searchReplaceState.visible = true
    searchReplaceState.query = 'foo'
    searchReplaceState.replacement = 'bar'
    searchReplaceState.matches = [{
      blockId: 'block-1',
      blockIndex: 0,
      blockType: 'NodeParagraph',
      end: 3,
      id: 'block-1:0:3',
      matchedText: 'foo',
      previewText: '[foo] bar foo',
      replaceable: true,
      rootId: 'root-1',
      start: 0,
    }]
    searchReplaceState.currentIndex = 0

    editorMocks.getBlockElement.mockReturnValue({
      outerHTML: '<div data-node-id="block-1" data-type="NodeParagraph"><div contenteditable="true">bar bar foo</div></div>',
    } as HTMLElement)
    editorMocks.applyReplacementsToClone.mockReturnValue({
      appliedCount: 1,
      clone: {
        outerHTML: '<div data-node-id="block-1" data-type="NodeParagraph"><div contenteditable="true">bar bar foo</div></div>',
      },
    })

    onEditorContextChanged(editorMocks.state.context)
    editorMocks.state.contextAvailable = false

    await replaceCurrent()

    expect(editorMocks.getBlockElement).toHaveBeenCalledTimes(1)
    expect(editorMocks.applyReplacementsToClone).toHaveBeenCalledTimes(1)
    expect(kernelMocks.updateDomBlock).toHaveBeenCalledTimes(1)
    expect(kernelMocks.updateDomBlock).toHaveBeenCalledWith(
      'block-1',
      '<div data-node-id="block-1" data-type="NodeParagraph"><div contenteditable="true">bar bar foo</div></div>',
    )
  })

  it('does not replace the current match when it comes from an attribute view block', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
      searchAttributeView: true,
    })
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
    searchReplaceState.currentIndex = 0

    await replaceCurrent()

    expect(editorMocks.getBlockElement).not.toHaveBeenCalled()
    expect(editorMocks.applyReplacementsToClone).not.toHaveBeenCalled()
    expect(kernelMocks.updateDomBlock).not.toHaveBeenCalled()
  })

  it('clears the cached selection scope after replacing inside selection-only mode', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })

    const selectionScope = new Map([
      ['block-1', [{ start: 0, end: 3 }]],
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
            previewText: '[foo] bar foo',
            replaceable: true,
            rootId: 'root-1',
            start: 0,
          }]
          : [],
      }
    })

    searchReplaceState.query = 'foo'
    searchReplaceState.replacement = 'bar'
    searchReplaceState.options.selectionOnly = true
    editorMocks.getBlockElement.mockReturnValue({
      outerHTML: '<div data-node-id="block-1" data-type="NodeParagraph"><div contenteditable="true">bar bar foo</div></div>',
    } as HTMLElement)
    editorMocks.applyReplacementsToClone.mockReturnValue({
      appliedCount: 1,
      clone: {
        outerHTML: '<div data-node-id="block-1" data-type="NodeParagraph"><div contenteditable="true">bar bar foo</div></div>',
      },
    })

    openPanel(true)
    await flushRefresh()

    expect(searchReplaceState.matches).toHaveLength(1)

    await replaceCurrent()

    expect(searchReplaceState.matches).toEqual([])
    expect(searchReplaceState.error).toBe('选区模式已开启，但当前没有可用选区')
  })

  it('does not reuse a stale cached selection scope after closing and reopening the panel', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })

    const selectionScope = new Map([
      ['block-1', [{ start: 0, end: 3 }]],
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
            previewText: '[foo] bar foo',
            replaceable: true,
            rootId: 'root-1',
            start: 0,
          }]
          : [],
      }
    })

    searchReplaceState.query = 'foo'
    searchReplaceState.options.selectionOnly = true

    openPanel(true)
    await flushRefresh()

    expect(searchReplaceState.matches).toHaveLength(1)

    closePanel()
    openPanel(true)
    await flushRefresh()

    expect(searchReplaceState.matches).toEqual([])
    expect(searchReplaceState.error).toBe('选区模式已开启，但当前没有可用选区')
  })

  it('clears the cached selection scope when editor interaction no longer has any live selection', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })

    const selectionScope = new Map([
      ['block-1', [{ start: 0, end: 3 }]],
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
            previewText: '[foo] bar foo',
            replaceable: true,
            rootId: 'root-1',
            start: 0,
          }]
          : [],
      }
    })

    searchReplaceState.query = 'foo'
    searchReplaceState.options.selectionOnly = true

    openPanel(true)
    await flushRefresh()

    expect(searchReplaceState.matches).toHaveLength(1)

    onEditorContextChanged(editorMocks.state.context)
    await flushRefresh()

    expect(searchReplaceState.matches).toEqual([])
    expect(searchReplaceState.error).toBe('选区模式已开启，但当前没有可用选区')
  })
})

async function flushRefresh() {
  await vi.runOnlyPendingTimersAsync()
}

function resetState() {
  searchReplaceState.visible = false
  searchReplaceState.replaceVisible = DEFAULT_SETTINGS.defaultReplaceVisible
  ;(searchReplaceState as any).minimapVisible = false
  ;(searchReplaceState as any).preserveCase = false
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
