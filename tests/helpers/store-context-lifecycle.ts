import { vi } from 'vitest'
import { closePanel } from '@/features/search-replace/store'
import { setPluginInstance } from '@/plugin-instance'
import {
  editorMocks,
  kernelMocks,
  searchEngineMocks,
} from './store-context-mocks'
import { resetState } from './store-context-state'

// 拆分自原 tests/store-context.test.ts 的 describe 级 beforeEach/afterEach（RF-103）。
// 每个拆分后的主题测试文件在 beforeEach/afterEach 中调用这两个函数，保证与原单文件行为一致。
export function resetStoreContextTest() {
  vi.useFakeTimers()
  resetState()
  setPluginInstance(null)
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
  kernelMocks.unfoldBlock.mockResolvedValue(null)
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
        occ: 0,
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
        occ: 0,
      },
    ],
  }))
}

export async function teardownStoreContextTest() {
  closePanel()
  setPluginInstance(null)
  await vi.runOnlyPendingTimersAsync()
  vi.useRealTimers()
}
