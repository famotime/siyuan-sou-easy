// @vitest-environment jsdom

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import type {
  EditorContext,
  SearchOptions,
} from '@/features/search-replace/types'

const kernelMocks = vi.hoisted(() => ({
  getAttributeViewKeysByAvID: vi.fn(async () => []),
  getBlockAttrs: vi.fn(async () => ({})),
  renderAttributeView: vi.fn(async () => ({
    view: {
      columns: [],
      rows: [],
    },
    viewType: 'table',
  })),
}))

vi.mock('@/features/search-replace/kernel', () => kernelMocks)

import { searchAttributeViewMatches } from '@/features/search-replace/attribute-view-search'

const DEFAULT_OPTIONS: SearchOptions = {
  includeCodeBlock: false,
  matchCase: false,
  searchAttributeView: true,
  selectionOnly: false,
  useRegex: false,
  wholeWord: false,
}

describe('attribute view search', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  it('searches visible attribute view cells when renderAttributeView returns no rows', async () => {
    const context = renderEditor(`
      <div data-node-id="av-block-1" data-type="NodeAttributeView" class="av" data-av-id="av-1" data-render="true">
        <div class="av__row av__row--header">
          <div class="av__body">
            <div class="av__cell av__cell--header"><div class="av__celltext">文本</div></div>
            <div class="av__cell av__cell--header"><div class="av__celltext">链接</div></div>
            <div class="av__cell av__cell--header"><div class="av__celltext">电话</div></div>
          </div>
        </div>
        <div class="av__row" data-id="item-1">
          <div class="av__body">
            <div class="av__cell"><div class="av__celltext">传感器</div></div>
            <div class="av__cell"><div class="av__celltext">传感器</div></div>
            <div class="av__cell"><div class="av__celltext">传感器</div></div>
          </div>
        </div>
      </div>
    `)

    const result = await searchAttributeViewMatches({
      context,
      options: DEFAULT_OPTIONS,
      query: '传感器',
      startingBlockIndex: 0,
    })

    expect(result.matches).toHaveLength(3)
    expect(result.matches.map(match => match.attributeView?.columnIndex)).toEqual([0, 1, 2])
    expect(result.matches.map(match => match.previewText)).toEqual([
      '文本: [传感器]',
      '链接: [传感器]',
      '电话: [传感器]',
    ])
  })

  it('searches visible attribute view titles and headers when API data is unavailable', async () => {
    const context = renderEditor(`
      <div data-node-id="av-block-2" data-type="NodeAttributeView" class="av" data-av-id="av-2" data-render="true">
        <div class="av__title">传感器表格</div>
        <div class="av__row av__row--header">
          <div class="av__body">
            <div class="av__cell av__cell--header"><div class="av__celltext">普通列</div></div>
            <div class="av__cell av__cell--header"><div class="av__celltext">传感器列</div></div>
          </div>
        </div>
      </div>
    `)

    const result = await searchAttributeViewMatches({
      context,
      options: DEFAULT_OPTIONS,
      query: '传感器',
      startingBlockIndex: 0,
    })

    expect(result.matches).toHaveLength(2)
    expect(result.matches.map(match => match.attributeView?.targetKind)).toEqual([
      'view-name',
      'column-header',
    ])
    expect(result.matches.map(match => match.previewText)).toEqual([
      '[传感器]表格',
      '[传感器]列',
    ])
  })

  it('searches grouped visible attribute view rows when API data is unavailable', async () => {
    const context = renderEditor(`
      <div data-node-id="av-block-3" data-type="NodeAttributeView" class="av" data-av-id="av-3" data-render="true">
        <div class="av__group">
          <div class="av__group-title">传感器分组</div>
          <div class="av__row" data-id="item-3">
            <div class="av__body">
              <div class="av__cell"><div class="av__celltext">分组里的传感器</div></div>
            </div>
          </div>
        </div>
      </div>
    `)

    const result = await searchAttributeViewMatches({
      context,
      options: DEFAULT_OPTIONS,
      query: '传感器',
      startingBlockIndex: 0,
    })

    expect(result.matches).toHaveLength(1)
    expect(result.matches[0]?.attributeView).toMatchObject({
      avBlockId: 'av-block-3',
      columnIndex: 0,
      itemID: 'item-3',
      rowID: 'item-3',
      targetKind: 'cell',
    })
    expect(result.matches[0]?.previewText).toBe('分组里的[传感器]')
  })

  it('searches rendered number field content when DOM candidates are unavailable', async () => {
    kernelMocks.getAttributeViewKeysByAvID.mockResolvedValue([
      { id: 'col-score', name: '评分' },
    ])
    kernelMocks.renderAttributeView.mockResolvedValue({
      view: {
        columns: [
          { id: 'col-score', name: '评分', type: 'number' },
        ],
        rows: [{
          cells: [{
            keyID: 'col-score',
            value: {
              number: {
                formattedContent: '42.5',
              },
              type: 'number',
            },
          }],
          id: 'item-4',
        }],
      },
      viewType: 'table',
    })

    const context = renderEditor(`
      <div data-node-id="av-block-4" data-type="NodeAttributeView" class="av" data-av-id="av-4"></div>
    `)

    const result = await searchAttributeViewMatches({
      context,
      options: DEFAULT_OPTIONS,
      query: '42.5',
      startingBlockIndex: 0,
    })

    expect(result.matches).toHaveLength(1)
    expect(result.matches[0]?.attributeView).toMatchObject({
      avBlockId: 'av-block-4',
      avID: 'av-4',
      columnName: '评分',
      itemID: 'item-4',
      keyID: 'col-score',
    })
    expect(result.matches[0]?.previewText).toBe('评分: [42.5]')
  })

  it('searches rendered rollup field content when DOM candidates are unavailable', async () => {
    kernelMocks.getAttributeViewKeysByAvID.mockResolvedValue([
      { id: 'col-rollup', name: '成员' },
    ])
    kernelMocks.renderAttributeView.mockResolvedValue({
      view: {
        columns: [
          { id: 'col-rollup', name: '成员', type: 'rollup' },
        ],
        rows: [{
          cells: [{
            keyID: 'col-rollup',
            value: {
              rollup: {
                contents: ['Alice', 'Bob'],
              },
              type: 'rollup',
            },
          }],
          id: 'item-5',
        }],
      },
      viewType: 'table',
    })

    const context = renderEditor(`
      <div data-node-id="av-block-5" data-type="NodeAttributeView" class="av" data-av-id="av-5"></div>
    `)

    const result = await searchAttributeViewMatches({
      context,
      options: DEFAULT_OPTIONS,
      query: 'Alice Bob',
      startingBlockIndex: 0,
    })

    expect(result.matches).toHaveLength(1)
    expect(result.matches[0]?.previewText).toBe('成员: [Alice Bob]')
  })

  it('resolves attribute view and view ids from block attrs when dataset ids are missing', async () => {
    kernelMocks.getBlockAttrs.mockResolvedValue({
      'custom-avs': '["av-6"]',
      'custom-sy-av-view': 'view-6',
    })
    kernelMocks.getAttributeViewKeysByAvID.mockResolvedValue([
      { id: 'col-title', name: '标题' },
    ])
    kernelMocks.renderAttributeView.mockResolvedValue({
      view: {
        columns: [
          { id: 'col-title', name: '标题', type: 'text' },
        ],
        rows: [{
          cells: [{
            keyID: 'col-title',
            value: {
              text: {
                content: '属性视图标题',
              },
              type: 'text',
            },
          }],
          id: 'item-6',
        }],
      },
      viewType: 'table',
    })

    const context = renderEditor(`
      <div data-node-id="av-block-6" data-type="NodeAttributeView" class="av"></div>
    `)

    const result = await searchAttributeViewMatches({
      context,
      options: DEFAULT_OPTIONS,
      query: '属性视图标题',
      startingBlockIndex: 0,
    })

    expect(kernelMocks.renderAttributeView).toHaveBeenCalledWith('av-6', 'view-6')
    expect(result.matches).toHaveLength(1)
    expect(result.matches[0]?.attributeView?.avID).toBe('av-6')
  })
})

function renderEditor(attributeViewDom: string): EditorContext {
  document.body.innerHTML = `
    <div class="protyle">
      <div class="protyle-content">
        <div class="protyle-wysiwyg">
          ${attributeViewDom}
        </div>
      </div>
    </div>
  `

  return {
    protyle: document.querySelector<HTMLElement>('.protyle')!,
    rootId: 'root-1',
    title: 'Doc 1',
  }
}
