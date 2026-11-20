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
describe('store context: attribute view search', () => {
  beforeEach(() => {
    resetStoreContextTest()
  })

  afterEach(async () => {
    await teardownStoreContextTest()
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
            occ: 0,
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
    expect(searchReplaceState.matches.some((match) => match.sourceKind === 'attribute-view')).toBe(false)
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
            occ: 0,
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
          occ: 0,
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
          occ: 0,
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
          occ: 0,
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
          occ: 0,
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
          occ: 0,
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
          occ: 0,
        }],
      }
    })

    searchReplaceState.query = '贾玲'

    openPanel(true)
    await flushRefresh()

    expect(searchReplaceState.matches).toHaveLength(1)
    expect(searchReplaceState.matches[0]?.attributeView?.columnIndex).toBe(0)
  })

  it('keeps attribute view matches in visual row-major order when merged into the result list', async () => {
    applyPluginSettings({
      ...DEFAULT_SETTINGS,
      preloadSelection: false,
      searchAttributeView: true,
    })

    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="av-block-order" data-type="NodeAttributeView" data-av-id="av-order" data-render="true">
              <div class="av__row av__row--header">
                <div class="av__body">
                  <div class="av__cell av__cell--header" data-av-key-id="col-1"><div class="av__celltext">列一</div></div>
                  <div class="av__cell av__cell--header" data-av-key-id="col-2"><div class="av__celltext">列二</div></div>
                </div>
              </div>
              <div class="av__row" data-id="row-b">
                <div class="av__body">
                  <div class="av__cell" data-av-key-id="col-1"><div class="av__celltext">foo 1</div></div>
                  <div class="av__cell" data-av-key-id="col-2"><div class="av__celltext">foo 2</div></div>
                </div>
              </div>
              <div class="av__row" data-id="row-a">
                <div class="av__body">
                  <div class="av__cell" data-av-key-id="col-1"><div class="av__celltext">foo 3</div></div>
                  <div class="av__cell" data-av-key-id="col-2"><div class="av__celltext">foo 4</div></div>
                </div>
              </div>
            </div>
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
    searchEngineMocks.findMatches.mockImplementation((blocks, query) => {
      if (blocks[0]?.blockType !== 'NodeAttributeView') {
        return {
          error: '',
          matches: [],
        }
      }

      expect(query).toBe('foo')
      return {
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
            previewText: '[foo]',
            replaceable: true,
            rootId: block.rootId,
            start,
          }]
        }),
      }
    })

    searchReplaceState.query = 'foo'

    openPanel(true)
    await flushRefresh()

    expect(searchReplaceState.matches.map((match) => ({
      columnIndex: match.attributeView?.columnIndex,
      previewText: match.previewText,
      rowID: match.attributeView?.rowID,
    }))).toEqual([
      {
        columnIndex: 0,
        previewText: '列一: [foo] 1',
        rowID: 'row-b',
      },
      {
        columnIndex: 1,
        previewText: '列二: [foo] 2',
        rowID: 'row-b',
      },
      {
        columnIndex: 0,
        previewText: '列一: [foo] 3',
        rowID: 'row-a',
      },
      {
        columnIndex: 1,
        previewText: '列二: [foo] 4',
        rowID: 'row-a',
      },
    ])
  })

})
