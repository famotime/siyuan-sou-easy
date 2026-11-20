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
  onEditorContextChanged,
  openPanel,
  replaceCurrent,
  searchReplaceState,
} from '@/features/search-replace/store'
import { DEFAULT_SETTINGS } from '@/settings'
import {
  resetStoreContextTest,
  teardownStoreContextTest,
} from './helpers/store-context-lifecycle'
import {
  editorMocks,
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
describe('store context: selection scope cache lifecycle', () => {
  beforeEach(() => {
    resetStoreContextTest()
  })

  afterEach(async () => {
    await teardownStoreContextTest()
  })

  it('clears the cached selection scope after replacing inside selection-only mode', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
    })

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
              previewText: '[foo] bar foo',
              replaceable: true,
              rootId: 'root-1',
              start: 0,
              occ: 0,
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
              previewText: '[foo] bar foo',
              replaceable: true,
              rootId: 'root-1',
              start: 0,
              occ: 0,
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
              previewText: '[foo] bar foo',
              replaceable: true,
              rootId: 'root-1',
              start: 0,
              occ: 0,
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
