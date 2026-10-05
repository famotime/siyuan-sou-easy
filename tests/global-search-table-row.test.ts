// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import {
  cleanMarkdownFormatting,
  extractTableRowSnippet,
  findMatchesInBlock,
  findMatchesInTableBlock,
  isTableSeparatorRow,
  parseTableRowsFromBlock,
} from '@/features/search-replace/global/doc-aggregator'
import {
  findTargetTableRowElement,
  scrollAndHighlightTableRow,
} from '@/features/search-replace/global/store'
import type { RawBlockRecord } from '@/features/search-replace/global/types'

describe('Global search table row parsing and positioning', () => {
  const sampleTableMarkdown = `
| 排名 | 文件名 | 文档大小 |
| ------| --------| ----------|
| 1 | [AI视频镜头语言提示词大全](siyuan://blocks/20260101-a1) | 188.4 MB |
| 2 | [台剧又出小众神作！](siyuan://blocks/20260102-a2) | 187.5 MB |
| 4 | [2元起淘，深圳的「旧货市场」是有多好逛？](siyuan://blocks/20260103-a3) | 171.6 MB |
| 6 | [深圳最冷门海边小镇，藏着一片深圳小众蓝宝石海](siyuan://blocks/20260104-a4) | 154.1 MB |
`.trim()

  const sampleTableBlock: RawBlockRecord = {
    id: 'block-table-1',
    root_id: 'doc-root-1',
    box: 'box-1',
    path: '/d1.sy',
    hpath: '/Top100大文件清单',
    content: '表格纯文本内容',
    markdown: sampleTableMarkdown,
    type: 't',
    created: '20261005120000',
    updated: '20261005120000',
  }

  describe('cleanMarkdownFormatting & isTableSeparatorRow', () => {
    it('cleans markdown links, bold, code, tags from cells', () => {
      const raw = '[深圳地铁6号线](siyuan://blocks/123) **推荐** `Hot` <u>查看</u>'
      expect(cleanMarkdownFormatting(raw)).toBe('深圳地铁6号线 推荐 Hot 查看')
    })

    it('identifies various markdown separator rows with variable spaces and colons', () => {
      expect(isTableSeparatorRow('|:---|:---|:---|')).toBe(true)
      expect(isTableSeparatorRow('| ------| --------| ----------|')).toBe(true)
      expect(isTableSeparatorRow('|-|:-:|-:|')).toBe(true)
      expect(isTableSeparatorRow('| 排名 | 文件名 |')).toBe(false)
      expect(isTableSeparatorRow('| 1 | 深圳 | 100MB |')).toBe(false)
    })
  })

  describe('parseTableRowsFromBlock', () => {
    it('parses markdown table into rows while ignoring alignment separator lines and cleaning markdown', () => {
      const rows = parseTableRowsFromBlock(sampleTableBlock)
      // 1 表头 + 4 数据行 = 5 行（已剔除 | ------| 分隔线行）
      expect(rows).toHaveLength(5)
      expect(rows[0].rowIndex).toBe(0)
      expect(rows[0].lineText).toBe('排名 | 文件名 | 文档大小')

      expect(rows[3].rowIndex).toBe(3)
      // 确保思源超链接 [标题](siyuan://...) 已被干净地去除，仅保留文字
      expect(rows[3].lineText).toBe('4 | 2元起淘，深圳的「旧货市场」是有多好逛？ | 171.6 MB')
      expect(rows[3].cells[1]).toBe('2元起淘，深圳的「旧货市场」是有多好逛？')
    })
  })

  describe('extractTableRowSnippet', () => {
    it('keeps row context within the line and highlights matches', () => {
      const line = '4 | 2元起淘，深圳的「旧货市场」是有多好逛？ | 171.6 MB'
      const start = line.indexOf('深圳')
      const snippet = extractTableRowSnippet(line, [
        { start, end: start + 2, text: '深圳' },
      ])

      expect(snippet.previewText).toBe(line)
      expect(snippet.segments.some(s => s.text === '深圳' && s.isMatch)).toBe(true)
      expect(snippet.segments[0].text).toBe('4 | 2元起淘，')
      expect(snippet.segments[0].isMatch).toBe(false)
    })

    it('highlights multiple occurrences within the same row in a single snippet', () => {
      const line = '6 | 深圳最冷门海边小镇，藏着一片深圳小众蓝宝石海 | 154.1 MB'
      const firstIdx = line.indexOf('深圳')
      const secondIdx = line.lastIndexOf('深圳')

      const snippet = extractTableRowSnippet(line, [
        { start: firstIdx, end: firstIdx + 2, text: '深圳' },
        { start: secondIdx, end: secondIdx + 2, text: '深圳' },
      ])

      const matchSegments = snippet.segments.filter(s => s.isMatch)
      expect(matchSegments).toHaveLength(2)
      expect(matchSegments[0].text).toBe('深圳')
      expect(matchSegments[1].text).toBe('深圳')
    })
  })

  describe('findMatchesInTableBlock & findMatchesInBlock', () => {
    it('finds table matches by row and merges same-row occurrences into 1 snippet with matchedCellText', () => {
      const matches = findMatchesInBlock(sampleTableBlock, '深圳')
      // 第4行(index 3) 出现 1 次，第6行(index 4) 出现 2 次 -> 共 2 条行结果项
      expect(matches).toHaveLength(2)

      // 第 1 条结果
      expect(matches[0].blockType).toBe('t')
      expect(matches[0].tableRowIndex).toBe(3)
      expect(matches[0].tableRowText).toContain('4 | 2元起淘，深圳')
      expect(matches[0].matchedCellText).toBe('2元起淘，深圳的「旧货市场」是有多好逛？')
      expect(matches[0].previewText).toContain('4 | 2元起淘，深圳的「旧货市场」是有多好逛？ | 171.6 MB')

      // 第 2 条结果：同一行内出现两次深圳，合并为 1 条
      expect(matches[1].tableRowIndex).toBe(4)
      expect(matches[1].tableRowText).toContain('6 | 深圳最冷门海边小镇')
      expect(matches[1].matchedCellText).toBe('深圳最冷门海边小镇，藏着一片深圳小众蓝宝石海')
      const highlightedSegs = matches[1].segments.filter(s => s.isMatch)
      expect(highlightedSegs).toHaveLength(2)
    })
  })

  describe('findTargetTableRowElement & scrollAndHighlightTableRow', () => {
    it('precisely matches target row among multiple rows containing the same keyword', () => {
      const tr0 = document.createElement('tr')
      tr0.textContent = '排名 文件名 大小'
      const tr1 = document.createElement('tr')
      tr1.textContent = '1 深圳第一行 100MB'
      const tr2 = document.createElement('tr')
      tr2.textContent = '2 深圳第二行 200MB'
      const tr3 = document.createElement('tr')
      tr3.textContent = '3 深圳第三行 300MB'

      const rows = [tr0, tr1, tr2, tr3]

      // 精确请求第 2 条 (index 2: "2 深圳第二行 200MB")
      const matched = findTargetTableRowElement(
        rows,
        2,
        '2 | 深圳第二行 | 200MB',
        '深圳',
        '深圳第二行',
      )
      expect(matched).toBe(tr2)

      // 即使 rowIndex 发生轻微偏移（如传入 undefined 或偏差），特征打分机制仍能锁定正确行，而不会误跳到第 1 行！
      const matchedByFeature = findTargetTableRowElement(
        rows,
        undefined,
        '3 | 深圳第三行 | 300MB',
        '深圳',
        '深圳第三行',
      )
      expect(matchedByFeature).toBe(tr3)
    })

    it('locates target row in table element, scrolls and applies highlight animation class', () => {
      const container = document.createElement('div')
      container.setAttribute('data-node-id', 'block-table-1')

      const tr0 = document.createElement('tr')
      tr0.textContent = '排名 文件名'
      const tr1 = document.createElement('tr')
      tr1.textContent = '1 AI视频'
      const tr4 = document.createElement('tr')
      tr4.textContent = '4 2元起淘，深圳的旧货市场 171.6 MB'

      const scrollIntoViewMock = vi.fn()
      tr4.scrollIntoView = scrollIntoViewMock

      container.appendChild(tr0)
      container.appendChild(tr1)
      container.appendChild(tr4)
      document.body.appendChild(container)

      scrollAndHighlightTableRow('block-table-1', 2, '4 | 2元起淘，深圳的旧货市场 | 171.6 MB', '深圳')

      expect(scrollIntoViewMock).toHaveBeenCalledWith(
        expect.objectContaining({
          behavior: 'smooth',
          block: 'center',
        }),
      )
      expect(tr4.classList.contains('sfsr-table-row-target-highlight')).toBe(true)

      container.remove()
    })
  })
})
