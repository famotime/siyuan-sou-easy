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
  openPanel,
  searchReplaceState,
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
describe('store context: selection preload & document snapshot', () => {
  beforeEach(() => {
    resetStoreContextTest()
  })

  afterEach(async () => {
    await teardownStoreContextTest()
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
      ['block-1', [{
        start: 4,
        end: 11,
        occ: 0,
      }]],
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
          occ: 0,
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
    expect(blocks.map((block) => block.blockId)).toEqual(['block-1', 'block-2'])
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
          occ: 0,
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
    expect(blocks.map((block) => ({
      blockId: block.blockId,
      text: block.text.trim(),
    }))).toEqual([
      {
        blockId: 'block-1',
        text: 'bar',
      },
      {
        blockId: 'block-2',
        text: 'foo',
      },
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
        occ: 0,
      })),
    }))

    searchReplaceState.query = 'foo'

    openPanel(true)
    await flushRefresh()

    expect(kernelMocks.getDocumentContent).toHaveBeenCalledWith('root-1')
    const blocks = searchEngineMocks.findMatches.mock.calls.at(-1)?.[0] as Array<{ blockId: string }>
    expect(blocks.map((block) => block.blockId)).toEqual(['block-live'])
    expect(searchReplaceState.matches).toHaveLength(1)
    expect(searchReplaceState.matches[0]?.blockId).toBe('block-live')
  })

})
