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
  onEditorContextChanged,
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
  kernelMocks,
} from './helpers/store-context-mocks'



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
describe('store context: replace actions', () => {
  beforeEach(() => {
    resetStoreContextTest()
  })

  afterEach(async () => {
    await teardownStoreContextTest()
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
      occ: 0,
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
      occ: 0,
    }]
    searchReplaceState.currentIndex = 0

    await replaceCurrent()

    expect(editorMocks.getBlockElement).not.toHaveBeenCalled()
    expect(editorMocks.applyReplacementsToClone).not.toHaveBeenCalled()
    expect(kernelMocks.updateDomBlock).not.toHaveBeenCalled()
  })

})
