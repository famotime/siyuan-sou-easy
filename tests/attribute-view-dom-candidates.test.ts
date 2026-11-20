import {
  describe,
  expect,
  it,
} from 'vitest'
import { extractDomAttributeViewSearchCandidates } from '@/features/search-replace/attribute-view/search-dom-candidates'

// RF-109：为属性视图 DOM 兜底采集路径补特征测试（此前零直接单测）。
// 每次属性视图搜索都会最先执行该路径（search-candidates.ts），且可能 dom-only 短路。

interface MountedAv {
  cleanup: () => void
  root: HTMLElement
}

function mountAv(html: string): MountedAv {
  const root = document.createElement('div')
  root.innerHTML = html
  document.body.appendChild(root)
  return {
    cleanup: () => root.remove(),
    root,
  }
}

function extractTexts(mounted: MountedAv) {
  const candidates = extractDomAttributeViewSearchCandidates({
    attributeViewBlock: {
      avBlockId: 'av-block-1',
      blockIndex: 0,
      element: mounted.root,
      rootId: 'root-1',
    },
    avID: 'av-1',
  })
  return candidates
}

describe('extractDomAttributeViewSearchCandidates（DOM 兜底路径）', () => {
  it('采集可见的视图标题为 view-name 候选并对重复文本去重', () => {
    const av = mountAv(`
      <div class="av">
        <div class="av__title">电影数据库</div>
        <div class="av__name">电影数据库</div>
        <div class="av__title fn__none">隐藏标题</div>
      </div>
    `)
    try {
      const candidates = extractTexts(av)
      const viewNames = candidates.filter((c) => c.targetKind === 'view-name')
      expect(viewNames).toHaveLength(1)
      expect(viewNames[0]).toMatchObject({
        avBlockId: 'av-block-1',
        avID: 'av-1',
        columnName: '电影数据库',
        keyID: '__dom-view-name-0__',
        text: '电影数据库',
        targetKind: 'view-name',
      })
    } finally {
      av.cleanup()
    }
  })

  it('采集表头单元格为 column-header 候选并按 keyID 对齐列序', () => {
    const av = mountAv(`
      <div class="av">
        <div class="av__row--header">
          <div class="av__cell av__cell--header" data-av-key-id="col-1"><div class="av__celltext">导演</div></div>
          <div class="av__cell av__cell--header" data-av-key-id="col-2"><div class="av__celltext">上映日期</div></div>
        </div>
      </div>
    `)
    try {
      const candidates = extractTexts(av)
      const headers = candidates.filter((c) => c.targetKind === 'column-header')
      expect(headers).toHaveLength(2)
      expect(headers[0]).toMatchObject({
        columnIndex: 0,
        keyID: 'col-1',
        text: '导演',
        targetKind: 'column-header',
      })
      expect(headers[1]).toMatchObject({
        columnIndex: 1,
        keyID: 'col-2',
        text: '上映日期',
      })
    } finally {
      av.cleanup()
    }
  })

  it('空文本的表头不产生候选但仍占用列序', () => {
    const av = mountAv(`
      <div class="av">
        <div class="av__row--header">
          <div class="av__cell av__cell--header" data-av-key-id="col-empty"></div>
          <div class="av__cell av__cell--header" data-av-key-id="col-2"><div class="av__celltext">列二</div></div>
        </div>
      </div>
    `)
    try {
      const candidates = extractTexts(av)
      const headers = candidates.filter((c) => c.targetKind === 'column-header')
      expect(headers).toHaveLength(1)
      expect(headers[0]).toMatchObject({
        columnIndex: 1,
        keyID: 'col-2',
      })
    } finally {
      av.cleanup()
    }
  })

  it('采集分组标题为 group-title 候选', () => {
    const av = mountAv(`
      <div class="av">
        <div class="av__group-title"><span>动作片</span></div>
      </div>
    `)
    try {
      const candidates = extractTexts(av)
      const groups = candidates.filter((c) => c.targetKind === 'group-title')
      expect(groups).toHaveLength(1)
      expect(groups[0]).toMatchObject({
        columnName: '动作片',
        keyID: '__dom-group-title-0__',
        targetKind: 'group-title',
      })
    } finally {
      av.cleanup()
    }
  })

  it('采集可见行单元格为 cell 候选：列名来自表头、rowLabel 取首格、去重相同列文本', () => {
    const av = mountAv(`
      <div class="av">
        <div class="av__row av__row--header">
          <div class="av__cell av__cell--header" data-av-key-id="col-name"><div class="av__celltext">片名</div></div>
          <div class="av__cell av__cell--header" data-av-key-id="col-year"><div class="av__celltext">年份</div></div>
        </div>
        <div class="av__row" data-id="row-a">
          <div class="av__body">
            <div class="av__cell" data-av-key-id="col-name"><div class="av__celltext">热辣滚烫</div></div>
            <div class="av__cell" data-av-key-id="col-year"><div class="av__celltext">2024</div></div>
            <div class="av__cell" data-av-key-id="col-year"><div class="av__celltext">2024</div></div>
          </div>
        </div>
      </div>
    `)
    try {
      const candidates = extractTexts(av)
      const cells = candidates.filter((c) => c.targetKind === 'cell')
      expect(cells).toHaveLength(2)
      expect(cells[0]).toMatchObject({
        columnName: '片名',
        columnIndex: 0,
        keyID: 'col-name',
        rowID: 'row-a',
        rowLabel: '热辣滚烫',
        text: '热辣滚烫',
        targetKind: 'cell',
      })
      expect(cells[1]).toMatchObject({
        columnName: '年份',
        columnIndex: 1,
        keyID: 'col-year',
        text: '2024',
      })
    } finally {
      av.cleanup()
    }
  })

  it('行内出现表头未知的 keyID 时为其发现新的列序', () => {
    const av = mountAv(`
      <div class="av">
        <div class="av__row av__row--header">
          <div class="av__cell av__cell--header" data-av-key-id="col-a"><div class="av__celltext">列A</div></div>
        </div>
        <div class="av__row" data-id="row-b">
          <div class="av__body">
            <div class="av__cell" data-av-key-id="col-a"><div class="av__celltext">甲</div></div>
            <div class="av__cell" data-av-key-id="col-new"><div class="av__celltext">乙</div></div>
          </div>
        </div>
      </div>
    `)
    try {
      const candidates = extractTexts(av)
      const cells = candidates.filter((c) => c.targetKind === 'cell')
      expect(cells).toHaveLength(2)
      expect(cells[0]).toMatchObject({
        columnIndex: 0,
        keyID: 'col-a',
      })
      // 未在表头出现过的 keyID：发现为下一可用列序（避开表头占用的 0 → 1）
      expect(cells[1]).toMatchObject({
        columnIndex: 1,
        keyID: 'col-new',
        columnName: '',
      })
    } finally {
      av.cleanup()
    }
  })

  it('嵌套的行/单元格元素只取顶层，避免重复采集', () => {
    const av = mountAv(`
      <div class="av">
        <div class="av__row av__row--header">
          <div class="av__cell av__cell--header" data-av-key-id="col-a"><div class="av__celltext">列A</div></div>
        </div>
        <div class="av__card" data-id="card-1">
          <div class="av__row" data-id="row-inner">
            <div class="av__body">
              <div class="av__cell" data-av-key-id="col-a"><div class="av__celltext">嵌套</div></div>
            </div>
          </div>
        </div>
      </div>
    `)
    try {
      const candidates = extractTexts(av)
      const cells = candidates.filter((c) => c.targetKind === 'cell')
      // card-1 与 row-inner 嵌套：行级取顶层 card-1；其内单元格只采集一次
      expect(cells).toHaveLength(1)
      expect(cells[0]).toMatchObject({
        rowID: 'card-1',
        text: '嵌套',
      })
    } finally {
      av.cleanup()
    }
  })

  it('隐藏行与 protyle-attr 内元素不产生候选，最终按 DOM 顺序输出', () => {
    const av = mountAv(`
      <div class="av">
        <div class="av__row" data-id="row-hidden fn__none-row">
          <div class="av__body fn__none">
            <div class="av__cell" data-av-key-id="col-a"><div class="av__celltext">隐藏</div></div>
          </div>
        </div>
        <div class="av__row" data-id="row-visible">
          <div class="av__body">
            <div class="av__cell" data-av-key-id="col-a"><div class="av__celltext">可见</div></div>
          </div>
        </div>
        <div class="protyle-attr">
          <div data-item-id="attr-row">
            <div class="av__cell" data-av-key-id="col-a"><div class="av__celltext">属性区</div></div>
          </div>
        </div>
      </div>
    `)
    try {
      const candidates = extractTexts(av)
      const cells = candidates.filter((c) => c.targetKind === 'cell')
      expect(cells).toHaveLength(1)
      expect(cells[0]).toMatchObject({
        rowID: 'row-visible',
        text: '可见',
      })
    } finally {
      av.cleanup()
    }
  })
})
