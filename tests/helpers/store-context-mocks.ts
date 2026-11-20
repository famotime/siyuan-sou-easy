import type {
  EditorContext,
  SearchableBlock,
  SearchMatch,
  SearchOptions,
  SelectionScope,
} from '@/features/search-replace/types'
import { vi } from 'vitest'

// 「文档内搜索 store」集成测试的共享 mock：editor / search-engine / kernel 三层。
// 拆分自原 tests/store-context.test.ts（RF-103）。各主题测试文件经 vi.mock 工厂内
// 动态 import 引用同一实例（工厂提升阶段无法直接引用导入绑定），并在 beforeEach
// 中统一重置实现（见 store-context-lifecycle.ts）。
export const editorMocks = (() => {
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
    collectSearchableBlocks: vi.fn((_context: EditorContext, _options?: SearchOptions) => state.blocks),
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
        .filter((block) => Boolean(block.text))
    }),
    createBlockElementFromDom: vi.fn(),
    findEditorContextByRootId: vi.fn(() => (state.contextAvailable ? state.context : null)),
    getActiveEditorContext: vi.fn(() => (state.contextAvailable ? state.context : null)),
    getBlockElement: vi.fn(),
    getCurrentSelectionScope: vi.fn(() => new Map()),
    getCurrentSelectionText: vi.fn(() => ''),
    isMatchVisible: vi.fn((_context: EditorContext, _match?: SearchMatch | null) => true),
    getUniqueBlockElements: vi.fn((root: ParentNode) => Array.from(root.querySelectorAll<HTMLElement>('[data-node-id][data-type]'))),
    scrollMatchIntoView: vi.fn(),
    syncSearchDecorations: vi.fn(),
  }
})()

export const searchEngineMocks = ({
  findMatches: vi.fn((_blocks: SearchableBlock[], _query: string, _options?: SearchOptions, _selectionScope?: SelectionScope) => ({
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
  })),
})

export const kernelMocks = ({
  getAttributeViewKeysByAvID: vi.fn(async () => []),
  getBlockAttrs: vi.fn(async () => ({})),
  getBlockDoms: vi.fn(async () => ({})),
  getDocumentContent: vi.fn(async () => ({
    blockCount: 0,
    content: '',
    eof: true,
  })),
  renderAttributeView: vi.fn(async () => null),
  unfoldBlock: vi.fn(async (_id?: string) => null),
  updateDomBlock: vi.fn(async () => null),
})
