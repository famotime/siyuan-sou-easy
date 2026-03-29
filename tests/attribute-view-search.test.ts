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
