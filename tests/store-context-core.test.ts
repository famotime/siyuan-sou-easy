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
  goNext,
  onEditorContextChanged,
  openPanel,
  searchReplaceState,
  setQuery,
} from '@/features/search-replace/store'
import { DEFAULT_SETTINGS } from '@/settings'
import {
  resetStoreContextTest,
  teardownStoreContextTest,
} from './helpers/store-context-lifecycle'
import {
  editorMocks,
  kernelMocks,
  searchEngineMocks,
} from './helpers/store-context-mocks'
import {
  createDeferred,
  flushRefresh,
} from './helpers/store-context-state'

vi.mock('@/features/search-replace/editor', async () => {
  const { editorMocks } = await import('./helpers/store-context-mocks')
  return editorMocks
})
vi.mock('@/features/search-replace/search-engine', async () => {
  const { searchEngineMocks } = await import('./helpers/store-context-mocks')
  return searchEngineMocks
})
vi.mock('@/features/search-replace/kernel', async () => {
  const { kernelMocks } = await import('./helpers/store-context-mocks')
  return kernelMocks
})

// 拆分自原 tests/store-context.test.ts（RF-103），54 个用例按主题分散到 8 个文件，总数守恒。
describe('store context: panel focus, canvas & readonly', () => {
  beforeEach(() => {
    resetStoreContextTest()
  })

  afterEach(async () => {
    await teardownStoreContextTest()
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

  it('searches canvas targets when the active editor context is a canvas host', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })
    const actualSearchEngine = await vi.importActual<typeof import('@/features/search-replace/search-engine')>(
      '@/features/search-replace/search-engine',
    )
    const canvasRoot = document.createElement('div')
    canvasRoot.className = 'siyuan-canvas__tab'
    document.body.appendChild(canvasRoot)
    const host = {
      getContext: () => ({
        filePath: '/data/storage/canvas/学习观 1-6.canvas',
        id: 'canvas:/data/storage/canvas/学习观 1-6.canvas',
        readonly: false,
        title: '学习观 1-6.canvas',
      }),
      getSnapshot: vi.fn(async () => ({
        revision: 'r1',
        targets: [{
          field: 'text',
          id: 'node:64045209d21177d3:text',
          nodeId: '64045209d21177d3',
          replaceable: true,
          text: '## 如何应用\n\n- 分而治之\n- 二阶知识',
          title: '如何应用',
          type: 'node',
        }],
      })),
      reveal: vi.fn(async () => true),
      replaceTextRanges: vi.fn(),
      root: canvasRoot,
      subscribe: vi.fn(() => vi.fn()),
      syncDecorations: vi.fn(),
      version: 1,
    }
    editorMocks.state.context = {
      canvas: {
        filePath: '/data/storage/canvas/学习观 1-6.canvas',
        host,
      },
      protyle: canvasRoot,
      rootId: 'canvas:/data/storage/canvas/学习观 1-6.canvas',
      sourceKind: 'canvas',
      title: '学习观 1-6.canvas',
    } as any
    searchEngineMocks.findMatches.mockImplementation(actualSearchEngine.findMatches)
    searchReplaceState.query = '分而治之'

    openPanel(true)
    await flushRefresh()

    expect(kernelMocks.getBlockAttrs).not.toHaveBeenCalled()
    expect(host.getSnapshot).toHaveBeenCalledTimes(1)
    expect(searchReplaceState.currentRootId).toBe('canvas:/data/storage/canvas/学习观 1-6.canvas')
    expect(searchReplaceState.searchableBlockCount).toBe(1)
    expect(searchReplaceState.matches).toHaveLength(1)
    expect(searchReplaceState.matches[0]).toMatchObject({
      blockId: 'canvas:node:64045209d21177d3:text',
      matchedText: '分而治之',
      sourceKind: 'canvas',
    })
  })

  it('uses the canvas host readonly flag without querying block attrs', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })
    const canvasRoot = document.createElement('div')
    document.body.appendChild(canvasRoot)
    const host = {
      getContext: () => ({
        filePath: '/data/storage/canvas/readonly.canvas',
        id: 'canvas:/data/storage/canvas/readonly.canvas',
        readonly: true,
        title: 'readonly.canvas',
      }),
      getSnapshot: vi.fn(async () => ({
        revision: 'r1',
        targets: [],
      })),
      root: canvasRoot,
      subscribe: vi.fn(() => vi.fn()),
      syncDecorations: vi.fn(),
      version: 1,
    }
    editorMocks.state.context = {
      canvas: {
        filePath: '/data/storage/canvas/readonly.canvas',
        host,
        readonly: true,
      },
      protyle: canvasRoot,
      rootId: 'canvas:/data/storage/canvas/readonly.canvas',
      sourceKind: 'canvas',
      title: 'readonly.canvas',
    } as any
    searchReplaceState.query = 'anything'

    openPanel(true)
    await flushRefresh()

    expect(kernelMocks.getBlockAttrs).not.toHaveBeenCalled()
    expect(searchReplaceState.documentReadonly).toBe(true)
  })

  it('marks the current document readonly when root attrs include sy-readonly', async () => {
    kernelMocks.getBlockAttrs.mockResolvedValue({
      'custom-sy-readonly': 'true',
    })
    searchReplaceState.query = 'foo'

    openPanel(true)
    await flushRefresh()

    expect(kernelMocks.getBlockAttrs).toHaveBeenCalledWith('root-1')
    expect(searchReplaceState.documentReadonly).toBe(true)
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
            occ: 0,
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
            occ: 0,
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
            occ: 0,
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

})
