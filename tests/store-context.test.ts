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
    isMatchVisible: vi.fn(() => true),
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
  goPrev,
  onEditorContextChanged,
  openPanel,
  replaceCurrent,
  setQuery,
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
    editorMocks.isMatchVisible.mockImplementation(() => true)
    kernelMocks.getAttributeViewKeysByAvID.mockResolvedValue([])
    kernelMocks.getBlockAttrs.mockResolvedValue({})
    kernelMocks.getBlockDoms.mockResolvedValue({})
    kernelMocks.getDocumentContent.mockResolvedValue({
      blockCount: 0,
      content: '',
      eof: true,
    })
    kernelMocks.renderAttributeView.mockResolvedValue(null)
    kernelMocks.updateDomBlock.mockResolvedValue(null)
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

  it('clears stale matches and highlights immediately when the query changes from the panel input', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })
    searchReplaceState.query = 'foo'

    openPanel(true)
    await flushRefresh()

    expect(searchReplaceState.matches).toHaveLength(2)

    searchReplaceState.currentIndex = 1
    searchReplaceState.navigationHint = 'pending'
    searchReplaceState.error = 'previous error'
    searchReplaceState.minimapBlocks = [{
      blockId: 'block-1',
      blockIndex: 0,
      blockType: 'NodeParagraph',
    }]
    searchReplaceState.searchableBlockCount = 1
    editorMocks.clearSearchDecorations.mockClear()

    setQuery('fo')

    expect(searchReplaceState.query).toBe('fo')
    expect(searchReplaceState.matches).toEqual([])
    expect(searchReplaceState.minimapBlocks).toEqual([])
    expect(searchReplaceState.searchableBlockCount).toBe(0)
    expect(searchReplaceState.navigationHint).toBe('')
    expect(searchReplaceState.error).toBe('')
    expect(editorMocks.clearSearchDecorations).toHaveBeenCalledTimes(1)
    expect(editorMocks.clearSearchDecorations).toHaveBeenCalledWith(editorMocks.state.context)
  })

  it('ignores stale async search results that finish after a newer query refresh', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })
    openPanel(true)
    await flushRefresh()

    const firstSnapshot = createDeferred<{
      blockCount: number
      content: string
      eof: boolean
    }>()
    let snapshotCallCount = 0

    kernelMocks.getDocumentContent.mockImplementation(() => {
      snapshotCallCount += 1
      if (snapshotCallCount === 1) {
        return firstSnapshot.promise
      }

      if (snapshotCallCount === 2) {
        return Promise.resolve({
          blockCount: 1,
          content: '<div class="protyle-wysiwyg"><div data-node-id="block-1" data-type="NodeParagraph">fo</div></div>',
          eof: true,
        })
      }

      return Promise.resolve({
        blockCount: 0,
        content: '',
        eof: true,
      })
    })
    searchEngineMocks.findMatches.mockImplementation((_blocks, query) => ({
      error: '',
      matches: query === 'foo'
        ? [{
          blockId: 'block-1',
          blockIndex: 0,
          blockType: 'NodeParagraph',
          end: 3,
          id: 'foo-match',
          matchedText: 'foo',
          previewText: '[foo]',
          replaceable: true,
          rootId: 'root-1',
          start: 0,
        }]
        : [{
          blockId: 'block-1',
          blockIndex: 0,
          blockType: 'NodeParagraph',
          end: 2,
          id: 'fo-match',
          matchedText: 'fo',
          previewText: '[fo]o',
          replaceable: true,
          rootId: 'root-1',
          start: 0,
        }],
    }))

    setQuery('foo')
    await vi.advanceTimersByTimeAsync(120)

    setQuery('fo')
    await vi.advanceTimersByTimeAsync(120)

    expect(searchReplaceState.query).toBe('fo')
    expect(searchReplaceState.matches).toHaveLength(1)
    expect(searchReplaceState.matches[0]?.id).toBe('fo-match')

    firstSnapshot.resolve({
      blockCount: 1,
      content: '<div class="protyle-wysiwyg"><div data-node-id="block-1" data-type="NodeParagraph">foo</div></div>',
      eof: true,
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(searchReplaceState.query).toBe('fo')
    expect(searchReplaceState.matches).toHaveLength(1)
    expect(searchReplaceState.matches[0]?.id).toBe('fo-match')
  })

  it('marks the panel as searching while long-document matches are still loading and clears it after completion', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })
    searchReplaceState.query = 'foo'

    const snapshot = createDeferred<{
      blockCount: number
      content: string
      eof: boolean
    }>()
    kernelMocks.getDocumentContent.mockImplementation(() => snapshot.promise)

    openPanel(true)
    await vi.advanceTimersByTimeAsync(0)

    expect((searchReplaceState as any).searching).toBe(true)

    snapshot.resolve({
      blockCount: 1,
      content: '<div class="protyle-wysiwyg"><div data-node-id="block-1" data-type="NodeParagraph">foo</div></div>',
      eof: true,
    })
    await flushRefresh()

    expect((searchReplaceState as any).searching).toBe(false)
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

  it('prefers live editor blocks over stale snapshot content for already loaded blocks', async () => {
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
      text: 'bar',
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
    searchEngineMocks.findMatches.mockImplementation((blocks, query) => ({
      error: '',
      matches: blocks.flatMap((block: any) => {
        const start = block.text.indexOf(query)
        if (start < 0) {
          return []
        }

        return [{
          blockId: block.blockId,
          blockIndex: block.blockIndex,
          blockType: block.blockType,
          end: start + query.length,
          id: `${block.blockId}:${start}:${start + query.length}`,
          matchedText: query,
          previewText: `[${query}]`,
          replaceable: true,
          rootId: block.rootId,
          start,
        }]
      }),
    }))

    searchReplaceState.query = 'foo'

    openPanel(true)
    await flushRefresh()

    const blocks = searchEngineMocks.findMatches.mock.calls.at(-1)?.[0] as Array<{ blockId: string, text: string }>
    expect(blocks.map(block => ({ blockId: block.blockId, text: block.text.trim() }))).toEqual([
      { blockId: 'block-1', text: 'bar' },
      { blockId: 'block-2', text: 'foo' },
    ])
    expect(searchReplaceState.matches).toHaveLength(1)
    expect(searchReplaceState.matches[0]?.blockId).toBe('block-2')
  })

  it('falls back to live editor blocks when document snapshot loading fails', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })

    editorMocks.state.blocks = [{
      blockId: 'block-live',
      blockIndex: 0,
      blockType: 'NodeParagraph',
      element: {} as HTMLElement,
      rootId: 'root-1',
      text: 'live foo',
    }]
    kernelMocks.getDocumentContent.mockRejectedValue(new Error('snapshot failed'))
    searchEngineMocks.findMatches.mockImplementation((blocks) => ({
      error: '',
      matches: blocks.map((block: any) => ({
        blockId: block.blockId,
        blockIndex: block.blockIndex,
        blockType: block.blockType,
        end: 8,
        id: `${block.blockId}:5:8`,
        matchedText: 'foo',
        previewText: 'live [foo]',
        replaceable: true,
        rootId: block.rootId,
        start: 5,
      })),
    }))

    searchReplaceState.query = 'foo'

    openPanel(true)
    await flushRefresh()

    expect(kernelMocks.getDocumentContent).toHaveBeenCalledWith('root-1')
    const blocks = searchEngineMocks.findMatches.mock.calls.at(-1)?.[0] as Array<{ blockId: string }>
    expect(blocks.map(block => block.blockId)).toEqual(['block-live'])
    expect(searchReplaceState.matches).toHaveLength(1)
    expect(searchReplaceState.matches[0]?.blockId).toBe('block-live')
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
      const matchedBlock = blocks.find((block: any) => (
        block?.blockType === 'NodeAttributeView'
        && block.text.includes('年会')
      ))
      if (matchedBlock) {
        return {
          error: '',
          matches: [{
            blockId: matchedBlock.blockId,
            blockIndex: matchedBlock.blockIndex,
            blockType: matchedBlock.blockType,
            end: 2,
            id: `${matchedBlock.blockId}:0:2`,
            matchedText: '年会',
            previewText: '[年会]',
            replaceable: true,
            rootId: matchedBlock.rootId,
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

  it('searches relation field content from attribute view rows using human-readable text', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
      searchAttributeView: true,
    })

    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="av-block-3" data-type="NodeAttributeView" data-av-id="av-3"></div>
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
        id: 'col-relation',
        name: '导演',
      },
    ])
    kernelMocks.renderAttributeView.mockResolvedValue({
      name: '电影',
      view: {
        columns: [{
          id: 'col-relation',
          name: '导演',
          type: 'relation',
        }],
        rows: [{
          cells: [{
            keyID: 'col-relation',
            value: {
              relation: {
                contents: [{
                  block: {
                    content: '贾玲',
                  },
                }],
              },
              type: 'relation',
            },
          }],
          id: 'item-3',
        }],
      },
      viewType: 'table',
    })
    searchEngineMocks.findMatches.mockImplementation((blocks, query) => {
      const matchedBlock = blocks.find((block: any) => (
        block?.blockType === 'NodeAttributeView'
        && block.text === query
      ))
      if (!matchedBlock) {
        return {
          error: '',
          matches: [],
        }
      }

      expect(matchedBlock.text).toBe('贾玲')
      expect(query).toBe('贾玲')
      return {
        error: '',
        matches: [{
          blockId: matchedBlock.blockId,
          blockIndex: matchedBlock.blockIndex,
          blockType: matchedBlock.blockType,
          end: 2,
          id: `${matchedBlock.blockId}:0:2`,
          matchedText: '贾玲',
          previewText: '[贾玲]',
          replaceable: true,
          rootId: matchedBlock.rootId,
          start: 0,
        }],
      }
    })

    searchReplaceState.query = '贾玲'

    openPanel(true)
    await flushRefresh()

    expect(searchReplaceState.matches).toHaveLength(1)
    expect(searchReplaceState.matches[0]?.previewText).toContain('导演')
  })

  it('searches attribute view column headers as read-only results', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
      searchAttributeView: true,
    })

    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="av-block-header" data-type="NodeAttributeView" data-av-id="av-header"></div>
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
        id: 'col-header',
        name: '导演',
      },
    ])
    kernelMocks.renderAttributeView.mockResolvedValue({
      name: '电影',
      view: {
        columns: [{
          id: 'col-header',
          name: '导演',
          type: 'relation',
        }],
        rows: [],
      },
      viewType: 'table',
    })
    searchEngineMocks.findMatches.mockImplementation((blocks, query) => {
      const matchedBlock = blocks.find((block: any) => (
        block?.blockType === 'NodeAttributeView'
        && block.text === query
      ))
      if (!matchedBlock) {
        return {
          error: '',
          matches: [],
        }
      }

      expect(matchedBlock.text).toBe('导演')
      expect(query).toBe('导演')
      return {
        error: '',
        matches: [{
          blockId: matchedBlock.blockId,
          blockIndex: matchedBlock.blockIndex,
          blockType: matchedBlock.blockType,
          end: 2,
          id: `${matchedBlock.blockId}:0:2`,
          matchedText: '导演',
          previewText: '[导演]',
          replaceable: true,
          rootId: matchedBlock.rootId,
          start: 0,
        }],
      }
    })

    searchReplaceState.query = '导演'

    openPanel(true)
    await flushRefresh()

    expect(searchReplaceState.matches).toHaveLength(1)
    expect(searchReplaceState.matches[0]?.blockId).toBe('av-block-header')
    expect(searchReplaceState.matches[0]?.attributeView).toMatchObject({
      columnName: '导演',
      keyID: 'col-header',
    })
  })

  it('searches attribute view titles as read-only results', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
      searchAttributeView: true,
    })

    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="av-block-title" data-type="NodeAttributeView" data-av-id="av-title"></div>
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
    kernelMocks.getAttributeViewKeysByAvID.mockResolvedValue([])
    kernelMocks.renderAttributeView.mockResolvedValue({
      name: '人员',
      view: {
        columns: [],
        name: '北京人',
        rows: [],
      },
      viewType: 'table',
    })
    searchEngineMocks.findMatches.mockImplementation((blocks, query) => {
      const firstBlock = blocks[0]
      if (firstBlock?.blockType !== 'NodeAttributeView') {
        return {
          error: '',
          matches: [],
        }
      }

      expect(firstBlock.text).toBe('人员')
      expect(query).toBe('人员')
      return {
        error: '',
        matches: [{
          blockId: firstBlock.blockId,
          blockIndex: firstBlock.blockIndex,
          blockType: firstBlock.blockType,
          end: 2,
          id: `${firstBlock.blockId}:0:2`,
          matchedText: '人员',
          previewText: '[人员]',
          replaceable: true,
          rootId: firstBlock.rootId,
          start: 0,
        }],
      }
    })

    searchReplaceState.query = '人员'

    openPanel(true)
    await flushRefresh()

    expect(searchReplaceState.matches).toHaveLength(1)
    expect(searchReplaceState.matches[0]?.blockId).toBe('av-block-title')
    expect(searchReplaceState.matches[0]?.sourceKind).toBe('attribute-view')
  })

  it('searches formatted date text from attribute view rows instead of raw timestamps', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
      searchAttributeView: true,
    })

    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="av-block-4" data-type="NodeAttributeView" data-av-id="av-4"></div>
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
        id: 'col-date',
        name: '上映日期',
      },
    ])
    kernelMocks.renderAttributeView.mockResolvedValue({
      name: '电影',
      view: {
        columns: [{
          id: 'col-date',
          name: '上映日期',
          type: 'date',
        }],
        rows: [{
          cells: [{
            keyID: 'col-date',
            value: {
              date: {
                content: 1707523200000,
                formattedContent: '',
                hasEndDate: false,
                isNotEmpty: true,
                isNotTime: true,
              },
              type: 'date',
            },
          }],
          id: 'item-4',
        }],
      },
      viewType: 'table',
    })
    searchEngineMocks.findMatches.mockImplementation((blocks, query) => {
      const matchedBlock = blocks.find((block: any) => (
        block?.blockType === 'NodeAttributeView'
        && block.text === query
      ))
      if (!matchedBlock) {
        return {
          error: '',
          matches: [],
        }
      }

      expect(matchedBlock.text).toBe('2024-02-10')
      expect(query).toBe('2024-02-10')
      return {
        error: '',
        matches: [{
          blockId: matchedBlock.blockId,
          blockIndex: matchedBlock.blockIndex,
          blockType: matchedBlock.blockType,
          end: 10,
          id: `${matchedBlock.blockId}:0:10`,
          matchedText: '2024-02-10',
          previewText: '[2024-02-10]',
          replaceable: true,
          rootId: matchedBlock.rootId,
          start: 0,
        }],
      }
    })

    searchReplaceState.query = '2024-02-10'

    openPanel(true)
    await flushRefresh()

    expect(searchReplaceState.matches).toHaveLength(1)
    expect(searchReplaceState.matches[0]?.previewText).toContain('上映日期')
  })

  it('searches asset field content from attribute view rows', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
      searchAttributeView: true,
    })

    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="av-block-5" data-type="NodeAttributeView" data-av-id="av-5"></div>
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
        id: 'col-asset',
        name: '海报',
      },
    ])
    kernelMocks.renderAttributeView.mockResolvedValue({
      name: '电影',
      view: {
        columns: [{
          id: 'col-asset',
          name: '海报',
          type: 'mAsset',
        }],
        rows: [{
          cells: [{
            keyID: 'col-asset',
            value: {
              mAsset: [{
                content: 'assets/poster.png',
                name: 'poster.png',
                type: 'image',
              }],
              type: 'mAsset',
            },
          }],
          id: 'item-5',
        }],
      },
      viewType: 'table',
    })
    searchEngineMocks.findMatches.mockImplementation((blocks, query) => {
      const matchedBlock = blocks.find((block: any) => (
        block?.blockType === 'NodeAttributeView'
        && block.text.includes(query)
      ))
      if (!matchedBlock) {
        return {
          error: '',
          matches: [],
        }
      }

      expect(matchedBlock.text).toContain('poster.png')
      expect(query).toBe('poster.png')
      return {
        error: '',
        matches: [{
          blockId: matchedBlock.blockId,
          blockIndex: matchedBlock.blockIndex,
          blockType: matchedBlock.blockType,
          end: 10,
          id: `${matchedBlock.blockId}:0:10`,
          matchedText: 'poster.png',
          previewText: '[poster.png]',
          replaceable: true,
          rootId: matchedBlock.rootId,
          start: 0,
        }],
      }
    })

    searchReplaceState.query = 'poster.png'

    openPanel(true)
    await flushRefresh()

    expect(searchReplaceState.matches).toHaveLength(1)
    expect(searchReplaceState.matches[0]?.previewText).toContain('海报')
  })

  it('uses the block-specific attribute view id when rendering search results', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
      searchAttributeView: true,
    })

    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="av-block-6" data-type="NodeAttributeView"></div>
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
    kernelMocks.getBlockAttrs.mockResolvedValue({
      'custom-avs': '["av-6"]',
      'custom-sy-av-view': 'view-6',
    })
    kernelMocks.getAttributeViewKeysByAvID.mockResolvedValue([])
    kernelMocks.renderAttributeView.mockResolvedValue({
      view: {
        columns: [],
        rows: [],
      },
      viewID: 'view-6',
      viewType: 'table',
    })
    searchEngineMocks.findMatches.mockImplementation(() => ({
      error: '',
      matches: [],
    }))

    searchReplaceState.query = 'anything'

    openPanel(true)
    await flushRefresh()

    expect(kernelMocks.renderAttributeView).toHaveBeenCalledWith('av-6', 'view-6')
  })

  it('keeps attribute view column indexes aligned with visible columns when hidden columns exist', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
      searchAttributeView: true,
    })

    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="av-block-7" data-type="NodeAttributeView" data-av-id="av-7"></div>
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
        id: 'hidden-col',
        name: '隐藏列',
      },
      {
        id: 'visible-col',
        name: '可见列',
      },
    ])
    kernelMocks.renderAttributeView.mockResolvedValue({
      view: {
        columns: [
          {
            hidden: true,
            id: 'hidden-col',
            name: '隐藏列',
          },
          {
            hidden: false,
            id: 'visible-col',
            name: '可见列',
          },
        ],
        rows: [{
          cells: [{
            keyID: 'visible-col',
            value: {
              text: {
                content: '贾玲',
              },
            },
          }],
          id: 'item-7',
        }],
      },
      viewType: 'table',
    })
    searchEngineMocks.findMatches.mockImplementation((blocks) => {
      const firstBlock = blocks[0]
      if (firstBlock?.blockType !== 'NodeAttributeView') {
        return {
          error: '',
          matches: [],
        }
      }

      return {
        error: '',
        matches: [{
          blockId: firstBlock.blockId,
          blockIndex: firstBlock.blockIndex,
          blockType: firstBlock.blockType,
          end: 2,
          id: `${firstBlock.blockId}:0:2`,
          matchedText: '贾玲',
          previewText: '[贾玲]',
          replaceable: true,
          rootId: firstBlock.rootId,
          start: 0,
        }],
      }
    })

    searchReplaceState.query = '贾玲'

    openPanel(true)
    await flushRefresh()

    expect(searchReplaceState.matches).toHaveLength(1)
    expect(searchReplaceState.matches[0]?.attributeView?.columnIndex).toBe(0)
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
      set: (_value: number) => {
        // Simulate a container that reports scroll metrics but ignores local scroll position updates.
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
    await vi.runAllTimersAsync()

    expect(searchReplaceState.navigationHint).toBe('')
  })

  it('pushes the viewport to the current lazy-load boundary when the target match is beyond the loaded block range', () => {
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
      set: (_value: number) => {
        // Simulate a container that ignores both scrollTo and direct scrollTop writes.
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
        return 'missing'
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
    expect(scrollContainer.scrollTo).toHaveBeenCalled()
    expect(scrollTop).toBe(900)
  })

  it('uses the currently visible loaded block range instead of sparse offscreen blocks when approximating navigation', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="block-1" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-4" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-5" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-10" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    const loadedBlocks = Array.from(document.querySelectorAll<HTMLElement>('.protyle-wysiwyg [data-node-id][data-type]'))
    let scrollTop = 0

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
      set: (_value: number) => {
        // Simulate a container that ignores both scrollTo and direct scrollTop writes.
      },
    })
    scrollContainer.scrollTo = vi.fn(({ top }: { top?: number }) => {
      scrollTop = top ?? scrollTop
    }) as any

    vi.spyOn(scrollContainer, 'getBoundingClientRect').mockReturnValue({
      bottom: 400,
      height: 300,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 100,
      width: 320,
      x: 0,
      y: 100,
    })

    vi.spyOn(loadedBlocks[0]!, 'getBoundingClientRect').mockReturnValue({
      bottom: 80,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 40,
      width: 320,
      x: 0,
      y: 40,
    })
    vi.spyOn(loadedBlocks[1]!, 'getBoundingClientRect').mockReturnValue({
      bottom: 220,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 180,
      width: 320,
      x: 0,
      y: 180,
    })
    vi.spyOn(loadedBlocks[2]!, 'getBoundingClientRect').mockReturnValue({
      bottom: 280,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 240,
      width: 320,
      x: 0,
      y: 240,
    })
    vi.spyOn(loadedBlocks[3]!, 'getBoundingClientRect').mockReturnValue({
      bottom: 620,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 580,
      width: 320,
      x: 0,
      y: 580,
    })

    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match) => {
      if (match?.id === 'block-8:0:3') {
        return 'missing'
      }

      return 'visible'
    })

    searchReplaceState.visible = true
    searchReplaceState.matches = [
      {
        blockId: 'block-4',
        blockIndex: 3,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-4:0:3',
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
    expect(scrollContainer.scrollTo).toHaveBeenCalled()
    expect(scrollTop).toBe(900)
  })

  it('uses the centered visible loaded segment instead of a sparse visible min-max range when the target block is still missing', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="block-4" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-5" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-11" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    const loadedBlocks = Array.from(document.querySelectorAll<HTMLElement>('.protyle-wysiwyg [data-node-id][data-type]'))
    let scrollTop = 0

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
      set: (_value: number) => {
        // Simulate a container that ignores both scrollTo and direct scrollTop writes.
      },
    })
    scrollContainer.scrollTo = vi.fn(({ top }: { top?: number }) => {
      scrollTop = top ?? scrollTop
    }) as any

    vi.spyOn(scrollContainer, 'getBoundingClientRect').mockReturnValue({
      bottom: 400,
      height: 300,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 100,
      width: 320,
      x: 0,
      y: 100,
    })

    vi.spyOn(loadedBlocks[0]!, 'getBoundingClientRect').mockReturnValue({
      bottom: 210,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 170,
      width: 320,
      x: 0,
      y: 170,
    })
    vi.spyOn(loadedBlocks[1]!, 'getBoundingClientRect').mockReturnValue({
      bottom: 270,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 230,
      width: 320,
      x: 0,
      y: 230,
    })
    vi.spyOn(loadedBlocks[2]!, 'getBoundingClientRect').mockReturnValue({
      bottom: 390,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 350,
      width: 320,
      x: 0,
      y: 350,
    })

    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match) => {
      if (match?.id === 'block-7:0:3') {
        return 'missing'
      }

      return 'visible'
    })

    searchReplaceState.visible = true
    searchReplaceState.matches = [
      {
        blockId: 'block-5',
        blockIndex: 4,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-5:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
      },
      {
        blockId: 'block-7',
        blockIndex: 6,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-7:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
      },
    ]
    searchReplaceState.currentIndex = 0
    searchReplaceState.searchableBlockCount = 12
    searchReplaceState.minimapBlocks = Array.from({ length: 12 }, (_, index) => ({
      blockId: `block-${index + 1}`,
      blockIndex: index,
      blockType: 'NodeParagraph',
    }))

    goNext()

    expect(searchReplaceState.currentIndex).toBe(1)
    expect(scrollContainer.scrollTo).toHaveBeenCalled()
    expect(scrollTop).toBe(900)
  })

  it('falls back to a scrollable ancestor when the protyle content container does not move', () => {
    document.body.innerHTML = `
      <div class="layout-tab-container" style="overflow: auto;">
        <div class="protyle">
          <div class="protyle-background" data-node-id="root-1"></div>
          <div class="protyle-title" data-node-id="root-1"></div>
          <input class="protyle-title__input" value="Doc 1" />
          <div class="protyle-content">
            <div class="protyle-wysiwyg">
              <div data-node-id="block-4" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
              <div data-node-id="block-5" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            </div>
          </div>
        </div>
      </div>
    `

    const hostContainer = document.querySelector<HTMLElement>('.layout-tab-container')!
    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    const loadedBlocks = Array.from(document.querySelectorAll<HTMLElement>('.protyle-wysiwyg [data-node-id][data-type]'))
    let hostScrollTop = 0
    const scrollTop = 450

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
      set: (_value: number) => {
        // Simulate a container that ignores both scrollTo and direct scrollTop writes.
      },
    })
    scrollContainer.scrollTo = vi.fn(() => {
      // Simulate the real SiYuan issue: this container reports dimensions but does not actually scroll.
    }) as any

    Object.defineProperty(hostContainer, 'clientHeight', {
      configurable: true,
      value: 300,
    })
    Object.defineProperty(hostContainer, 'scrollHeight', {
      configurable: true,
      value: 1600,
    })
    Object.defineProperty(hostContainer, 'scrollTop', {
      configurable: true,
      get: () => hostScrollTop,
      set: (value: number) => {
        hostScrollTop = value
      },
    })
    hostContainer.scrollTo = vi.fn(({ top }: { top?: number }) => {
      hostScrollTop = top ?? hostScrollTop
    }) as any

    vi.spyOn(scrollContainer, 'getBoundingClientRect').mockReturnValue({
      bottom: 400,
      height: 300,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 100,
      width: 320,
      x: 0,
      y: 100,
    })
    vi.spyOn(hostContainer, 'getBoundingClientRect').mockReturnValue({
      bottom: 420,
      height: 300,
      left: 0,
      right: 360,
      toJSON: () => ({}),
      top: 120,
      width: 360,
      x: 0,
      y: 120,
    })
    vi.spyOn(loadedBlocks[0]!, 'getBoundingClientRect').mockReturnValue({
      bottom: 220,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 180,
      width: 320,
      x: 0,
      y: 180,
    })
    vi.spyOn(loadedBlocks[1]!, 'getBoundingClientRect').mockReturnValue({
      bottom: 280,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 240,
      width: 320,
      x: 0,
      y: 240,
    })

    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match) => {
      if (match?.id === 'block-80:0:3') {
        return 'missing'
      }

      return 'visible'
    })

    searchReplaceState.visible = true
    searchReplaceState.matches = [
      {
        blockId: 'block-5',
        blockIndex: 4,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-5:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
      },
      {
        blockId: 'block-80',
        blockIndex: 79,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-80:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
      },
    ]
    searchReplaceState.currentIndex = 0
    searchReplaceState.searchableBlockCount = 100
    searchReplaceState.minimapBlocks = Array.from({ length: 100 }, (_, index) => ({
      blockId: `block-${index + 1}`,
      blockIndex: index,
      blockType: 'NodeParagraph',
    }))

    goNext()

    expect(searchReplaceState.currentIndex).toBe(1)
    expect(scrollContainer.scrollTo).toHaveBeenCalled()
    expect(hostContainer.scrollTo).toHaveBeenCalled()
    expect(hostScrollTop).toBe(1300)
  })

  it('prefers a stable ancestor over a transition content container that snaps back after scroll', async () => {
    document.body.innerHTML = `
      <div class="layout-tab-container" style="overflow: auto;">
        <div class="protyle">
          <div class="protyle-background" data-node-id="root-1"></div>
          <div class="protyle-title" data-node-id="root-1"></div>
          <input class="protyle-title__input" value="Doc 1" />
          <div class="protyle-content protyle-content--transition">
            <div class="protyle-wysiwyg">
              <div data-node-id="block-4" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
              <div data-node-id="block-5" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            </div>
          </div>
        </div>
      </div>
    `

    const hostContainer = document.querySelector<HTMLElement>('.layout-tab-container')!
    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    const loadedBlocks = Array.from(document.querySelectorAll<HTMLElement>('.protyle-wysiwyg [data-node-id][data-type]'))
    let hostScrollTop = 0
    let transitionScrollTop = 450

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
      get: () => transitionScrollTop,
      set: (value: number) => {
        transitionScrollTop = value
        window.setTimeout(() => {
          transitionScrollTop = 450
        }, 0)
      },
    })
    scrollContainer.scrollTo = vi.fn(({ top }: { top?: number }) => {
      transitionScrollTop = top ?? transitionScrollTop
      window.setTimeout(() => {
        transitionScrollTop = 450
      }, 0)
    }) as any

    Object.defineProperty(hostContainer, 'clientHeight', {
      configurable: true,
      value: 300,
    })
    Object.defineProperty(hostContainer, 'scrollHeight', {
      configurable: true,
      value: 1600,
    })
    Object.defineProperty(hostContainer, 'scrollTop', {
      configurable: true,
      get: () => hostScrollTop,
      set: (value: number) => {
        hostScrollTop = value
      },
    })
    hostContainer.scrollTo = vi.fn(({ top }: { top?: number }) => {
      hostScrollTop = top ?? hostScrollTop
    }) as any

    vi.spyOn(scrollContainer, 'getBoundingClientRect').mockReturnValue({
      bottom: 400,
      height: 300,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 100,
      width: 320,
      x: 0,
      y: 100,
    })
    vi.spyOn(hostContainer, 'getBoundingClientRect').mockReturnValue({
      bottom: 420,
      height: 300,
      left: 0,
      right: 360,
      toJSON: () => ({}),
      top: 120,
      width: 360,
      x: 0,
      y: 120,
    })
    vi.spyOn(loadedBlocks[0]!, 'getBoundingClientRect').mockReturnValue({
      bottom: 220,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 180,
      width: 320,
      x: 0,
      y: 180,
    })
    vi.spyOn(loadedBlocks[1]!, 'getBoundingClientRect').mockReturnValue({
      bottom: 280,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 240,
      width: 320,
      x: 0,
      y: 240,
    })

    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match, mode) => {
      if (match?.id === 'block-80:0:3') {
        if (mode === 'if-needed') {
          return 'missing'
        }

        return hostScrollTop >= 1300 ? 'scrolled' : 'missing'
      }

      return 'visible'
    })
    editorMocks.isMatchVisible.mockImplementation((_context, match) => {
      if (match?.id !== 'block-80:0:3') {
        return true
      }

      return hostScrollTop >= 1300
    })

    searchReplaceState.visible = true
    searchReplaceState.matches = [
      {
        blockId: 'block-5',
        blockIndex: 4,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-5:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
      },
      {
        blockId: 'block-80',
        blockIndex: 79,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-80:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
      },
    ]
    searchReplaceState.currentIndex = 0
    searchReplaceState.searchableBlockCount = 100
    searchReplaceState.minimapBlocks = Array.from({ length: 100 }, (_, index) => ({
      blockId: `block-${index + 1}`,
      blockIndex: index,
      blockType: 'NodeParagraph',
    }))

    goNext()

    expect(searchReplaceState.currentIndex).toBe(1)
    expect(searchReplaceState.navigationHint).toContain('等待内容加载')

    await vi.advanceTimersByTimeAsync(120)

    expect(searchReplaceState.navigationHint).toBe('')
    expect(hostContainer.scrollTo).toHaveBeenCalled()
    expect(hostScrollTop).toBe(1300)
  })

  it('falls back to directly setting scrollTop when the scroll container scrollTo call is ignored', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="block-4" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-5" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    const loadedBlocks = Array.from(document.querySelectorAll<HTMLElement>('.protyle-wysiwyg [data-node-id][data-type]'))
    let scrollTop = 450

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
    scrollContainer.scrollTo = vi.fn(() => {
      // Simulate the live SiYuan case: the method exists but does not move the element.
    }) as any

    vi.spyOn(scrollContainer, 'getBoundingClientRect').mockReturnValue({
      bottom: 400,
      height: 300,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 100,
      width: 320,
      x: 0,
      y: 100,
    })
    vi.spyOn(loadedBlocks[0]!, 'getBoundingClientRect').mockReturnValue({
      bottom: 220,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 180,
      width: 320,
      x: 0,
      y: 180,
    })
    vi.spyOn(loadedBlocks[1]!, 'getBoundingClientRect').mockReturnValue({
      bottom: 280,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 240,
      width: 320,
      x: 0,
      y: 240,
    })

    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match) => {
      if (match?.id === 'block-80:0:3') {
        return 'missing'
      }

      return 'visible'
    })

    searchReplaceState.visible = true
    searchReplaceState.matches = [
      {
        blockId: 'block-5',
        blockIndex: 4,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-5:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
      },
      {
        blockId: 'block-80',
        blockIndex: 79,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-80:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
      },
    ]
    searchReplaceState.currentIndex = 0
    searchReplaceState.searchableBlockCount = 100
    searchReplaceState.minimapBlocks = Array.from({ length: 100 }, (_, index) => ({
      blockId: `block-${index + 1}`,
      blockIndex: index,
      blockType: 'NodeParagraph',
    }))

    goNext()

    expect(searchReplaceState.currentIndex).toBe(1)
    expect(scrollContainer.scrollTo).toHaveBeenCalled()
    expect(scrollTop).toBe(900)
  })

  it('prefers the visible scroll container when multiple protyle content containers exist during transition', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content protyle-content--transition" data-container="stale">
          <div class="protyle-wysiwyg">
            <div data-node-id="block-4" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-5" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
          </div>
        </div>
        <div class="protyle-content protyle-content--transition" data-container="visible">
          <div class="protyle-wysiwyg">
            <div data-node-id="block-4" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-5" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const [staleScrollContainer, visibleScrollContainer] = Array.from(document.querySelectorAll<HTMLElement>('.protyle-content'))
    const visibleLoadedBlocks = Array.from(visibleScrollContainer!.querySelectorAll<HTMLElement>('.protyle-wysiwyg [data-node-id][data-type]'))
    let staleScrollTop = 0
    let visibleScrollTop = 450

    Object.defineProperty(staleScrollContainer!, 'clientHeight', {
      configurable: true,
      value: 300,
    })
    Object.defineProperty(staleScrollContainer!, 'scrollHeight', {
      configurable: true,
      value: 1200,
    })
    Object.defineProperty(staleScrollContainer!, 'scrollTop', {
      configurable: true,
      get: () => staleScrollTop,
      set: (value: number) => {
        staleScrollTop = value
      },
    })
    staleScrollContainer!.scrollTo = vi.fn(({ top }: { top?: number }) => {
      staleScrollTop = top ?? staleScrollTop
    }) as any

    Object.defineProperty(visibleScrollContainer!, 'clientHeight', {
      configurable: true,
      value: 300,
    })
    Object.defineProperty(visibleScrollContainer!, 'scrollHeight', {
      configurable: true,
      value: 1200,
    })
    Object.defineProperty(visibleScrollContainer!, 'scrollTop', {
      configurable: true,
      get: () => visibleScrollTop,
      set: (value: number) => {
        visibleScrollTop = value
      },
    })
    visibleScrollContainer!.scrollTo = vi.fn(({ top }: { top?: number }) => {
      visibleScrollTop = top ?? visibleScrollTop
    }) as any

    vi.spyOn(staleScrollContainer!, 'getBoundingClientRect').mockReturnValue({
      bottom: -200,
      height: 300,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: -500,
      width: 320,
      x: 0,
      y: -500,
    })
    vi.spyOn(visibleScrollContainer!, 'getBoundingClientRect').mockReturnValue({
      bottom: 400,
      height: 300,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 100,
      width: 320,
      x: 0,
      y: 100,
    })
    vi.spyOn(visibleLoadedBlocks[0]!, 'getBoundingClientRect').mockReturnValue({
      bottom: 220,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 180,
      width: 320,
      x: 0,
      y: 180,
    })
    vi.spyOn(visibleLoadedBlocks[1]!, 'getBoundingClientRect').mockReturnValue({
      bottom: 280,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 240,
      width: 320,
      x: 0,
      y: 240,
    })

    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match) => {
      if (match?.id === 'block-80:0:3') {
        return 'missing'
      }

      return 'visible'
    })

    searchReplaceState.visible = true
    searchReplaceState.matches = [
      {
        blockId: 'block-5',
        blockIndex: 4,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-5:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
      },
      {
        blockId: 'block-80',
        blockIndex: 79,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-80:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
      },
    ]
    searchReplaceState.currentIndex = 0
    searchReplaceState.searchableBlockCount = 100
    searchReplaceState.minimapBlocks = Array.from({ length: 100 }, (_, index) => ({
      blockId: `block-${index + 1}`,
      blockIndex: index,
      blockType: 'NodeParagraph',
    }))

    goNext()

    expect(searchReplaceState.currentIndex).toBe(1)
    expect(visibleScrollContainer!.scrollTo).toHaveBeenCalled()
    expect(visibleScrollTop).toBe(900)
    expect(staleScrollTop).toBe(0)
  })

  it('uses the visible wysiwyg root when a transition content container still contains a stale root', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content protyle-content--transition">
          <div class="protyle-wysiwyg" data-root="stale">
            <div data-node-id="block-1" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-2" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-3" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-4" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-5" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
          </div>
          <div class="protyle-wysiwyg" data-root="visible">
            <div data-node-id="block-70" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-71" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-72" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-73" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-74" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    const [staleRoot, visibleRoot] = Array.from(document.querySelectorAll<HTMLElement>('.protyle-wysiwyg'))
    const staleBlocks = Array.from(staleRoot!.querySelectorAll<HTMLElement>('[data-node-id][data-type]'))
    const visibleBlocks = Array.from(visibleRoot!.querySelectorAll<HTMLElement>('[data-node-id][data-type]'))
    let scrollTop = 450

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

    vi.spyOn(scrollContainer, 'getBoundingClientRect').mockReturnValue({
      bottom: 400,
      height: 300,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 100,
      width: 320,
      x: 0,
      y: 100,
    })
    vi.spyOn(staleRoot!, 'getBoundingClientRect').mockReturnValue({
      bottom: -100,
      height: 220,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: -320,
      width: 320,
      x: 0,
      y: -320,
    })
    vi.spyOn(visibleRoot!, 'getBoundingClientRect').mockReturnValue({
      bottom: 380,
      height: 220,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 160,
      width: 320,
      x: 0,
      y: 160,
    })

    staleBlocks.forEach((block, index) => {
      vi.spyOn(block, 'getBoundingClientRect').mockReturnValue({
        bottom: 250 + (index * 20),
        height: 40,
        left: 0,
        right: 320,
        toJSON: () => ({}),
        top: 210 + (index * 20),
        width: 320,
        x: 0,
        y: 210 + (index * 20),
      })
    })
    visibleBlocks.forEach((block, index) => {
      vi.spyOn(block, 'getBoundingClientRect').mockReturnValue({
        bottom: 340 + (index * 20),
        height: 40,
        left: 0,
        right: 320,
        toJSON: () => ({}),
        top: 300 + (index * 20),
        width: 320,
        x: 0,
        y: 300 + (index * 20),
      })
    })

    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match) => {
      if (match?.id === 'block-40:0:3') {
        return 'missing'
      }

      return 'visible'
    })

    searchReplaceState.visible = true
    searchReplaceState.matches = [
      {
        blockId: 'block-72',
        blockIndex: 71,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-72:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
      },
      {
        blockId: 'block-40',
        blockIndex: 39,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-40:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
      },
    ]
    searchReplaceState.currentIndex = 0
    searchReplaceState.searchableBlockCount = 100
    searchReplaceState.minimapBlocks = Array.from({ length: 100 }, (_, index) => ({
      blockId: `block-${index + 1}`,
      blockIndex: index,
      blockType: 'NodeParagraph',
    }))

    goNext()

    expect(searchReplaceState.currentIndex).toBe(1)
    expect(scrollContainer.scrollTo).toHaveBeenCalled()
    expect(scrollTop).toBe(0)
  })

  it('keeps retrying long-document navigation when the lazy-load boundary is still advancing', async () => {
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
    let lazyLoadStep = 0

    Object.defineProperty(scrollContainer, 'clientHeight', {
      configurable: true,
      value: 300,
    })
    Object.defineProperty(scrollContainer, 'scrollHeight', {
      configurable: true,
      get: () => 1200 + (lazyLoadStep * 30),
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
      lazyLoadStep += 1
    }) as any

    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match) => {
      if (match?.id === 'block-80:0:3') {
        return lazyLoadStep >= 45 ? 'scrolled' : 'missing'
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
        blockId: 'block-80',
        blockIndex: 79,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-80:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
      },
    ]
    searchReplaceState.currentIndex = 0
    searchReplaceState.searchableBlockCount = 100
    searchReplaceState.minimapBlocks = Array.from({ length: 100 }, (_, index) => ({
      blockId: `block-${index + 1}`,
      blockIndex: index,
      blockType: 'NodeParagraph',
    }))

    goNext()
    expect(searchReplaceState.navigationHint).toContain('等待内容加载')

    await vi.advanceTimersByTimeAsync(45 * 120)

    expect(lazyLoadStep).toBeGreaterThanOrEqual(45)
    expect(searchReplaceState.navigationHint).toBe('')
    expect(editorMocks.scrollMatchIntoView).toHaveBeenCalledTimes(47)
  })

  it('keeps retrying forward navigation while waiting at the lower lazy-load boundary', async () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="block-6" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    let scrollTop = 900
    let directScrollAttempts = 0

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
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match, mode) => {
      if (match?.id === 'block-80:0:3') {
        if (mode === 'if-needed') {
          return 'missing'
        }

        directScrollAttempts += 1
        return directScrollAttempts >= 45 ? 'scrolled' : 'missing'
      }

      return 'visible'
    })
    editorMocks.isMatchVisible.mockImplementation((_context, match) => {
      if (match?.id !== 'block-80:0:3') {
        return true
      }

      return directScrollAttempts >= 45
    })

    searchReplaceState.visible = true
    searchReplaceState.matches = [
      {
        blockId: 'block-6',
        blockIndex: 5,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-6:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
      },
      {
        blockId: 'block-80',
        blockIndex: 79,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-80:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
      },
    ]
    searchReplaceState.currentIndex = 0
    searchReplaceState.searchableBlockCount = 100
    searchReplaceState.minimapBlocks = Array.from({ length: 100 }, (_, index) => ({
      blockId: `block-${index + 1}`,
      blockIndex: index,
      blockType: 'NodeParagraph',
    }))

    goNext()

    expect(searchReplaceState.currentIndex).toBe(1)
    expect(searchReplaceState.navigationHint).toContain('等待内容加载')

    await vi.advanceTimersByTimeAsync(45 * 120)

    expect(searchReplaceState.navigationHint).toBe('')
    expect(editorMocks.scrollMatchIntoView).toHaveBeenCalledTimes(46)
    expect(scrollContainer.scrollTo).toHaveBeenCalled()
    expect(scrollTop).toBe(900)
  })

  it('keeps pending navigation active until the scrolled target is actually visible', async () => {
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
    let directScrollAttempts = 0
    let visibilityChecks = 0

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
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match, mode) => {
      if (match?.id === 'block-8:0:3') {
        if (mode === 'if-needed') {
          return 'missing'
        }

        directScrollAttempts += 1
        return directScrollAttempts === 1 ? 'missing' : 'scrolled'
      }

      return 'visible'
    })
    editorMocks.isMatchVisible.mockImplementation((_context, match) => {
      if (match?.id !== 'block-8:0:3') {
        return true
      }

      visibilityChecks += 1
      return visibilityChecks >= 2
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

    expect(searchReplaceState.navigationHint).toContain('等待内容加载')

    await vi.advanceTimersByTimeAsync(120)
    expect(searchReplaceState.navigationHint).toContain('等待内容加载')

    await vi.advanceTimersByTimeAsync(120)
    expect(searchReplaceState.navigationHint).toBe('')
    expect(editorMocks.isMatchVisible).toHaveBeenCalled()
  })

  it('keeps retrying backward navigation while waiting at the upper lazy-load boundary', async () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="block-6" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    let scrollTop = 120
    let directScrollAttempts = 0

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
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match, mode) => {
      if (match?.id === 'block-1:0:3') {
        if (mode === 'if-needed') {
          return 'missing'
        }

        directScrollAttempts += 1
        return directScrollAttempts >= 45 ? 'scrolled' : 'missing'
      }

      return 'visible'
    })
    editorMocks.isMatchVisible.mockImplementation((_context, match) => {
      if (match?.id !== 'block-1:0:3') {
        return true
      }

      return directScrollAttempts >= 45
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
        blockId: 'block-6',
        blockIndex: 5,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-6:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
      },
    ]
    searchReplaceState.currentIndex = 1
    searchReplaceState.searchableBlockCount = 10
    searchReplaceState.minimapBlocks = Array.from({ length: 10 }, (_, index) => ({
      blockId: `block-${index + 1}`,
      blockIndex: index,
      blockType: 'NodeParagraph',
    }))

    goPrev()

    expect(searchReplaceState.currentIndex).toBe(0)
    expect(searchReplaceState.navigationHint).toContain('等待内容加载')

    await vi.advanceTimersByTimeAsync(45 * 120)

    expect(searchReplaceState.navigationHint).toBe('')
    expect(editorMocks.scrollMatchIntoView).toHaveBeenCalledTimes(46)
    expect(scrollContainer.scrollTo).toHaveBeenCalled()
    expect(scrollTop).toBe(0)
  })

  it('nudges the upper lazy-load boundary when retries stay pinned at scrollTop 0', async () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="block-40" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    let scrollTop = 0
    let directScrollAttempts = 0
    let nudgedAwayFromBoundary = false
    let boundaryStimulated = false
    const scrollPositions: number[] = []

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
        scrollPositions.push(value)
        if (value === 1 && scrollTop === 0) {
          nudgedAwayFromBoundary = true
        }
        if (value === 0 && nudgedAwayFromBoundary) {
          boundaryStimulated = true
        }
        scrollTop = value
      },
    })
    scrollContainer.scrollTo = vi.fn(({ top }: { top?: number }) => {
      if (typeof top === 'number') {
        scrollTop = top
      }
    }) as any

    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match, mode) => {
      if (match?.id === 'block-1:0:3') {
        if (mode === 'if-needed') {
          return 'missing'
        }

        directScrollAttempts += 1
        return boundaryStimulated && directScrollAttempts >= 2 ? 'scrolled' : 'missing'
      }

      return 'visible'
    })
    editorMocks.isMatchVisible.mockImplementation((_context, match) => {
      if (match?.id !== 'block-1:0:3') {
        return true
      }

      return boundaryStimulated && directScrollAttempts >= 2
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
        blockId: 'block-40',
        blockIndex: 39,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-40:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
      },
    ]
    searchReplaceState.currentIndex = 1
    searchReplaceState.searchableBlockCount = 100
    searchReplaceState.minimapBlocks = Array.from({ length: 100 }, (_, index) => ({
      blockId: `block-${index + 1}`,
      blockIndex: index,
      blockType: 'NodeParagraph',
    }))

    goPrev()

    expect(searchReplaceState.currentIndex).toBe(0)
    expect(searchReplaceState.navigationHint).toContain('等待内容加载')

    await vi.advanceTimersByTimeAsync(120)

    expect(searchReplaceState.navigationHint).toBe('')
    expect(scrollPositions).toContain(1)
    expect(scrollTop).toBe(0)
  })

  it('abandons pending navigation after repeated misses and clears the loading hint', async () => {
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
        return 'missing'
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
    expect(searchReplaceState.navigationHint).toContain('等待内容加载')

    await vi.runAllTimersAsync()

    expect(searchReplaceState.navigationHint).toBe('')
    expect(editorMocks.scrollMatchIntoView).toHaveBeenCalledTimes(41)
    expect(scrollContainer.scrollTo).toHaveBeenCalled()
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

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })

  return {
    promise,
    resolve,
  }
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
