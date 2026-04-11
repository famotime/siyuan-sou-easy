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

    const rowMatch = result.matches.find(match => match.attributeView?.targetKind === 'cell')
    expect(rowMatch).toBeDefined()
    expect(rowMatch?.attributeView).toMatchObject({
      avBlockId: 'av-block-3',
      columnIndex: 0,
      itemID: 'item-3',
      rowID: 'item-3',
      targetKind: 'cell',
    })
    expect(rowMatch?.previewText).toBe('分组里的[传感器]')
  })

  it('searches grouped attribute view titles when API data is unavailable', async () => {
    const context = renderEditor(`
      <div data-node-id="av-block-group-title" data-type="NodeAttributeView" class="av" data-av-id="av-group-title" data-render="true">
        <div class="av__group">
          <div class="av__group-title">传感器分组</div>
          <div class="av__row" data-id="item-group-title">
            <div class="av__body">
              <div class="av__cell"><div class="av__celltext">普通内容</div></div>
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
      avBlockId: 'av-block-group-title',
      targetKind: 'group-title',
    })
    expect(result.matches[0]?.previewText).toBe('[传感器]分组')
  })

  it('keeps grouped DOM matches in visual top-to-bottom left-to-right order', async () => {
    const context = renderEditor(`
      <div data-node-id="av-block-dom-order" data-type="NodeAttributeView" class="av" data-av-id="av-dom-order" data-render="true">
        <div class="av__title">传感器</div>
        <div class="av__group">
          <div class="av__group-title">111</div>
          <div class="av__row av__row--header">
            <div class="av__body">
              <div class="av__cell av__cell--header"><div class="av__celltext">传感器</div></div>
              <div class="av__cell av__cell--header"><div class="av__celltext">单选</div></div>
              <div class="av__cell av__cell--header"><div class="av__celltext">文本</div></div>
              <div class="av__cell av__cell--header"><div class="av__celltext">传感器</div></div>
            </div>
          </div>
          <div class="av__row" data-id="item-1">
            <div class="av__body">
              <div class="av__cell"><div class="av__celltext">foo</div></div>
              <div class="av__cell"><div class="av__celltext">传感器</div></div>
              <div class="av__cell"><div class="av__celltext">bar</div></div>
              <div class="av__cell"><div class="av__celltext">baz</div></div>
            </div>
          </div>
        </div>
        <div class="av__group">
          <div class="av__group-title">字段 [传感器] 为空</div>
          <div class="av__row av__row--header">
            <div class="av__body">
              <div class="av__cell av__cell--header"><div class="av__celltext">传感器</div></div>
              <div class="av__cell av__cell--header"><div class="av__celltext">单选</div></div>
              <div class="av__cell av__cell--header"><div class="av__celltext">文本</div></div>
              <div class="av__cell av__cell--header"><div class="av__celltext">传感器</div></div>
            </div>
          </div>
          <div class="av__row" data-id="item-2">
            <div class="av__body">
              <div class="av__cell"><div class="av__celltext">传感器</div></div>
              <div class="av__cell"><div class="av__celltext"></div></div>
              <div class="av__cell"><div class="av__celltext"></div></div>
              <div class="av__cell"><div class="av__celltext"></div></div>
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

    expect(result.matches.map(match => match.previewText)).toEqual([
      '[传感器]',
      '[传感器]',
      '[传感器]',
      '单选: [传感器]',
      '字段 [[传感器]] 为空',
      '[传感器]',
      '[传感器]',
      '传感器: [传感器]',
    ])
  })

  it('deduplicates split-pane table cells while keeping logical column order', async () => {
    const context = renderEditor(`
      <div data-node-id="av-block-split-order" data-type="NodeAttributeView" class="av" data-av-id="av-split-order" data-render="true">
        <div class="av__row av__row--header">
          <div class="av__body">
            <div class="av__cell av__cell--header" data-key-id="col-fixed"><div class="av__celltext">固定列</div></div>
            <div class="av__cell av__cell--header" data-key-id="col-main"><div class="av__celltext">主列</div></div>
            <div class="av__cell av__cell--header" data-key-id="col-tail"><div class="av__celltext">尾列</div></div>
          </div>
        </div>
        <div class="av__table-pane av__table-pane--scrollable">
          <div class="av__row" data-id="item-1">
            <div class="av__body">
              <div class="av__cell" data-key-id="col-main"><div class="av__celltext">传感器-main</div></div>
              <div class="av__cell" data-key-id="col-tail"><div class="av__celltext">传感器-tail</div></div>
            </div>
          </div>
          <div class="av__row" data-id="item-2">
            <div class="av__body">
              <div class="av__cell" data-key-id="col-main"><div class="av__celltext">传感器-main-2</div></div>
              <div class="av__cell" data-key-id="col-tail"><div class="av__celltext">传感器-tail-2</div></div>
            </div>
          </div>
        </div>
        <div class="av__table-pane av__table-pane--fixed">
          <div class="av__row" data-id="item-1">
            <div class="av__body">
              <div class="av__cell" data-key-id="col-fixed"><div class="av__celltext">传感器-fixed</div></div>
            </div>
          </div>
          <div class="av__row" data-id="item-2">
            <div class="av__body">
              <div class="av__cell" data-key-id="col-fixed"><div class="av__celltext">传感器-fixed-2</div></div>
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

    expect(result.matches).toHaveLength(6)
    expect(result.matches.map(match => ({
      columnIndex: match.attributeView?.columnIndex,
      keyID: match.attributeView?.keyID,
      rowID: match.attributeView?.rowID,
    }))).toEqual([
      { columnIndex: 0, keyID: 'col-fixed', rowID: 'item-1' },
      { columnIndex: 1, keyID: 'col-main', rowID: 'item-1' },
      { columnIndex: 2, keyID: 'col-tail', rowID: 'item-1' },
      { columnIndex: 0, keyID: 'col-fixed', rowID: 'item-2' },
      { columnIndex: 1, keyID: 'col-main', rowID: 'item-2' },
      { columnIndex: 2, keyID: 'col-tail', rowID: 'item-2' },
    ])
    expect(result.matches.map(match => match.previewText)).toEqual([
      '固定列: [传感器]-fixed',
      '主列: [传感器]-main',
      '尾列: [传感器]-tail',
      '固定列: [传感器]-fixed-2',
      '主列: [传感器]-main-2',
      '尾列: [传感器]-tail-2',
    ])
  })

  it('keeps blank keyed header slots in canonical split-pane column order', async () => {
    const context = renderEditor(`
      <div data-node-id="av-block-split-blank-header" data-type="NodeAttributeView" class="av" data-av-id="av-split-blank-header" data-render="true">
        <div class="av__row av__row--header">
          <div class="av__body">
            <div class="av__cell av__cell--header" data-key-id="col-fixed"><div class="av__celltext">固定列</div></div>
            <div class="av__cell av__cell--header" data-key-id="col-blank"><div class="av__celltext"></div></div>
            <div class="av__cell av__cell--header" data-key-id="col-tail"><div class="av__celltext">尾列</div></div>
          </div>
        </div>
        <div class="av__table-pane av__table-pane--scrollable">
          <div class="av__row" data-id="item-1">
            <div class="av__body">
              <div class="av__cell" data-key-id="col-tail"><div class="av__celltext">传感器-tail</div></div>
              <div class="av__cell" data-key-id="col-blank"><div class="av__celltext">传感器-blank</div></div>
            </div>
          </div>
        </div>
        <div class="av__table-pane av__table-pane--fixed">
          <div class="av__row" data-id="item-1">
            <div class="av__body">
              <div class="av__cell" data-key-id="col-fixed"><div class="av__celltext">传感器-fixed</div></div>
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

    expect(result.matches).toHaveLength(3)
    expect(result.matches.map(match => ({
      columnIndex: match.attributeView?.columnIndex,
      keyID: match.attributeView?.keyID,
      previewText: match.previewText,
    }))).toEqual([
      { columnIndex: 0, keyID: 'col-fixed', previewText: '固定列: [传感器]-fixed' },
      { columnIndex: 1, keyID: 'col-blank', previewText: '[传感器]-blank' },
      { columnIndex: 2, keyID: 'col-tail', previewText: '尾列: [传感器]-tail' },
    ])
  })

  it('appends body-only keyed columns after header-defined columns', async () => {
    const context = renderEditor(`
      <div data-node-id="av-block-body-only-column" data-type="NodeAttributeView" class="av" data-av-id="av-body-only-column" data-render="true">
        <div class="av__row av__row--header">
          <div class="av__body">
            <div class="av__cell av__cell--header" data-key-id="col-fixed"><div class="av__celltext">固定列</div></div>
            <div class="av__cell av__cell--header" data-key-id="col-main"><div class="av__celltext">主列</div></div>
          </div>
        </div>
        <div class="av__row" data-id="item-1">
          <div class="av__body">
            <div class="av__cell" data-key-id="col-extra"><div class="av__celltext">传感器-extra</div></div>
            <div class="av__cell" data-key-id="col-fixed"><div class="av__celltext">传感器-fixed</div></div>
            <div class="av__cell" data-key-id="col-main"><div class="av__celltext">传感器-main</div></div>
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
    expect(result.matches.map(match => ({
      columnIndex: match.attributeView?.columnIndex,
      columnName: match.attributeView?.columnName,
      keyID: match.attributeView?.keyID,
      previewText: match.previewText,
    }))).toEqual([
      { columnIndex: 0, columnName: '固定列', keyID: 'col-fixed', previewText: '固定列: [传感器]-fixed' },
      { columnIndex: 1, columnName: '主列', keyID: 'col-main', previewText: '主列: [传感器]-main' },
      { columnIndex: 2, columnName: '', keyID: 'col-extra', previewText: '[传感器]-extra' },
    ])
  })

  it('deduplicates cloned DOM rows for the same attribute view cell', async () => {
    const context = renderEditor(`
      <div data-node-id="av-block-dom-clones" data-type="NodeAttributeView" class="av" data-av-id="av-dom-clones" data-render="true">
        <div class="av__row av__row--header">
          <div class="av__body">
            <div class="av__cell av__cell--header"><div class="av__celltext">主键</div></div>
          </div>
        </div>
        <div class="av__table-pane av__table-pane--fixed">
          <div class="av__row" data-id="item-1">
            <div class="av__body">
              <div class="av__cell"><div class="av__celltext">传感器</div></div>
            </div>
          </div>
        </div>
        <div class="av__table-pane av__table-pane--scrollable">
          <div class="av__row" data-id="item-1">
            <div class="av__body">
              <div class="av__cell"><div class="av__celltext">传感器</div></div>
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
    expect(result.matches[0]?.previewText).toBe('主键: [传感器]')
  })

  it('does not double-count a logical cell rendered in multiple panes', async () => {
    const context = renderEditor(`
      <div data-node-id="av-block-split-duplicates" data-type="NodeAttributeView" class="av" data-av-id="av-split-duplicates" data-render="true">
        <div class="av__row av__row--header">
          <div class="av__body">
            <div class="av__cell av__cell--header"><div class="av__celltext">主键</div></div>
          </div>
        </div>
        <div class="av__table-pane av__table-pane--fixed">
          <div class="av__row" data-id="item-1">
            <div class="av__body">
              <div class="av__cell" data-key-id="col-primary"><div class="av__celltext">传感器</div></div>
            </div>
          </div>
        </div>
        <div class="av__table-pane av__table-pane--scrollable">
          <div class="av__row" data-id="item-1">
            <div class="av__body">
              <div class="av__cell"><div class="av__celltext"></div></div>
              <div class="av__cell" data-key-id="col-primary"><div class="av__celltext">传感器</div></div>
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
      columnIndex: 0,
      keyID: 'col-primary',
      rowID: 'item-1',
    })
    expect(result.matches[0]?.previewText).toBe('主键: [传感器]')
  })

  it('ignores hidden inactive attribute view DOM from other views', async () => {
    const context = renderEditor(`
      <div data-node-id="av-block-hidden-views" data-type="NodeAttributeView" class="av" data-av-id="av-hidden-views" data-render="true">
        <div class="av__view av__view--table">
          <div class="av__row av__row--header">
            <div class="av__body">
              <div class="av__cell av__cell--header"><div class="av__celltext">主键</div></div>
            </div>
          </div>
          <div class="av__row" data-id="item-1">
            <div class="av__body">
              <div class="av__cell"><div class="av__celltext">传感器</div></div>
            </div>
          </div>
        </div>
        <div class="av__view av__view--gallery" aria-hidden="true">
          <div class="av__gallery-item" data-id="item-1">
            <div class="av__card-body">
              <div data-key-id="col-1"><div class="av__celltext">传感器</div></div>
            </div>
          </div>
        </div>
        <div class="av__view av__view--kanban" hidden>
          <div class="av__kanban-item" data-id="item-1">
            <div class="av__body">
              <div class="av__cell"><div class="av__celltext">传感器</div></div>
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
    expect(result.matches[0]?.previewText).toBe('主键: [传感器]')
  })

  it('does not search text that exists only inside hidden inactive views', async () => {
    const context = renderEditor(`
      <div data-node-id="av-block-hidden-only" data-type="NodeAttributeView" class="av" data-av-id="av-hidden-only" data-render="true">
        <div class="av__view av__view--table">
          <div class="av__row av__row--header">
            <div class="av__body">
              <div class="av__cell av__cell--header"><div class="av__celltext">主键</div></div>
            </div>
          </div>
          <div class="av__row" data-id="item-1">
            <div class="av__body">
              <div class="av__cell"><div class="av__celltext">Alpha</div></div>
            </div>
          </div>
        </div>
        <div class="av__view av__view--gallery" aria-hidden="true">
          <div class="av__gallery-item" data-id="item-2">
            <div class="av__card-body">
              <div data-key-id="col-1"><div class="av__celltext">传感器</div></div>
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

    expect(result.matches).toHaveLength(0)
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

  it('resolves view ids from sy-av-view block attrs when custom-sy-av-view is unavailable', async () => {
    kernelMocks.getBlockAttrs.mockResolvedValue({
      'custom-avs': '["av-6b"]',
      'sy-av-view': 'view-6b',
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
          id: 'item-6b',
        }],
      },
      viewType: 'kanban',
      viewID: 'view-6b',
    })

    const context = renderEditor(`
      <div data-node-id="av-block-6b" data-type="NodeAttributeView" class="av"></div>
    `)

    const result = await searchAttributeViewMatches({
      context,
      options: DEFAULT_OPTIONS,
      query: '属性视图标题',
      startingBlockIndex: 0,
    })

    expect(kernelMocks.renderAttributeView).toHaveBeenCalledWith('av-6b', 'view-6b')
    expect(result.matches).toHaveLength(1)
    expect(result.matches[0]?.attributeView?.avID).toBe('av-6b')
  })

  it('merges rendered kanban card content when DOM only exposes titles and headers', async () => {
    kernelMocks.getAttributeViewKeysByAvID.mockResolvedValue([
      { id: 'col-title', name: '标题' },
    ])
    kernelMocks.renderAttributeView.mockResolvedValue({
      view: {
        columns: [
          { id: 'col-title', name: '标题', type: 'text' },
        ],
        groups: [{
          id: 'group-1',
          cards: [{
            id: 'card-1',
            itemID: 'card-1',
            fields: [{
              keyID: 'col-title',
              value: {
                text: {
                  content: '看板里的传感器卡片',
                },
                type: 'text',
              },
            }],
          }],
        }],
      },
      viewID: 'view-kanban',
      viewType: 'kanban',
    })

    const context = renderEditor(`
      <div
        data-node-id="av-block-7"
        data-type="NodeAttributeView"
        class="av"
        data-av-id="av-7"
        data-av-view-id="view-kanban"
        data-av-type="kanban"
      >
        <div class="av__title">设备看板</div>
        <div class="av__row av__row--header">
          <div class="av__body">
            <div class="av__cell av__cell--header"><div class="av__celltext">标题</div></div>
          </div>
        </div>
      </div>
    `)

    const result = await searchAttributeViewMatches({
      context,
      options: DEFAULT_OPTIONS,
      query: '传感器卡片',
      startingBlockIndex: 0,
    })

    expect(result.matches).toHaveLength(1)
    expect(result.matches[0]?.attributeView).toMatchObject({
      avBlockId: 'av-block-7',
      avID: 'av-7',
      itemID: 'card-1',
      keyID: 'col-title',
      targetKind: 'cell',
    })
    expect(result.matches[0]?.previewText).toBe('标题: 看板里的[传感器卡片]')
  })

  it('ignores rendered fallback rows when the API returns a different view than the active kanban view', async () => {
    kernelMocks.getAttributeViewKeysByAvID.mockResolvedValue([
      { id: 'col-title', name: '标题' },
    ])
    kernelMocks.renderAttributeView.mockResolvedValue({
      view: {
        columns: [
          { id: 'col-title', name: '标题', type: 'text' },
        ],
        rows: [{
          id: 'row-table-1',
          cells: [{
            keyID: 'col-title',
            value: {
              text: {
                content: '默认表格里的传感器',
              },
              type: 'text',
            },
          }],
        }],
      },
      viewID: 'view-table',
      viewType: 'table',
    })

    const context = renderEditor(`
      <div
        data-node-id="av-block-8"
        data-type="NodeAttributeView"
        class="av"
        data-av-id="av-8"
        data-av-view-id="view-kanban"
        data-av-type="kanban"
      >
        <div class="av__title">设备看板</div>
      </div>
    `)

    const result = await searchAttributeViewMatches({
      context,
      options: DEFAULT_OPTIONS,
      query: '默认表格里的传感器',
      startingBlockIndex: 0,
    })

    expect(result.matches).toHaveLength(0)
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
