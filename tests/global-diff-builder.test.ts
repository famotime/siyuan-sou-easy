import { describe, expect, it } from 'vitest'
import {
  buildVisualDiff,
  computeReplacement,
} from '@/features/search-replace/global/diff-builder'
import type { DocAggregateNode } from '@/features/search-replace/global/types'

describe('diff-builder', () => {
  describe('computeReplacement', () => {
    it('returns simple replacement when preserveCase is false', () => {
      expect(computeReplacement('Hello', 'world')).toBe('world')
    })

    it('respects uppercase, lowercase, and capitalized in preserveCase mode', () => {
      expect(computeReplacement('FOO', 'bar', { preserveCase: true })).toBe('BAR')
      expect(computeReplacement('foo', 'bar', { preserveCase: true })).toBe('bar')
      expect(computeReplacement('Foo', 'bar', { preserveCase: true })).toBe('Bar')
    })
  })

  describe('buildVisualDiff', () => {
    it('builds diff summary with groups, counts, and exclusion states', () => {
      const docNodes: DocAggregateNode[] = [
        {
          rootId: 'doc-1',
          boxId: 'b1',
          hpath: '/path/doc1',
          docTitle: 'Doc 1',
          updated: '20261005120000',
          created: '20261005120000',
          collapsed: false,
          totalCount: 2,
          matches: [
            {
              matchId: 'm1',
              blockId: 'b1',
              rootId: 'doc-1',
              blockType: 'p',
              matchedText: 'apple',
              prefixText: 'eat an ',
              suffixText: ' today',
              previewText: 'eat an apple today',
              segments: [],
              fullContent: 'eat an apple today',
              sort: 0,
              updated: '',
              created: '',
              hpath: '/path/doc1',
              box: 'b1',
              selectedForReplace: true,
              startOffset: 7,
              endOffset: 12,
            },
            {
              matchId: 'm2',
              blockId: 'b2',
              rootId: 'doc-1',
              blockType: 'p',
              matchedText: 'apple',
              prefixText: 'another ',
              suffixText: ' here',
              previewText: 'another apple here',
              segments: [],
              fullContent: 'another apple here',
              sort: 1,
              updated: '',
              created: '',
              hpath: '/path/doc1',
              box: 'b1',
              selectedForReplace: false, // 排除项
              startOffset: 8,
              endOffset: 13,
            },
          ],
        },
      ]

      const diff = buildVisualDiff(docNodes, 'orange')
      expect(diff.totalCount).toBe(2)
      expect(diff.includedCount).toBe(1)
      expect(diff.excludedCount).toBe(1)
      expect(diff.affectedDocCount).toBe(1)
      expect(diff.groups).toHaveLength(1)

      const group = diff.groups[0]
      expect(group.items).toHaveLength(2)
      expect(group.items[0].replacedText).toBe('orange')
      expect(group.items[0].excluded).toBe(false)
      expect(group.items[1].excluded).toBe(true)
    })

    it('expands multi-occurrence match into granular DiffItems for fine-grained replacement', () => {
      const docNodes: DocAggregateNode[] = [
        {
          rootId: 'doc-phone',
          boxId: 'b1',
          hpath: '/test/phone',
          docTitle: '海信双屏手机A2 PRO和海信双屏手机A6',
          updated: '20261005120000',
          created: '20261005120000',
          collapsed: false,
          totalCount: 1, // 侧栏列表仅 1 条
          matches: [
            {
              matchId: 'doc-phone:4',
              blockId: 'doc-phone',
              rootId: 'doc-phone',
              blockType: 'd',
              matchedText: '手机, 手机',
              prefixText: '海信双屏',
              suffixText: 'A6',
              previewText: '海信双屏手机A2 PRO和海信双屏手机A6',
              segments: [],
              fullContent: '海信双屏手机A2 PRO和海信双屏手机A6',
              sort: 0,
              updated: '',
              created: '',
              hpath: '/test/phone',
              box: 'b1',
              selectedForReplace: true,
              startOffset: 4,
              endOffset: 20,
              occurrences: [
                { start: 4, end: 6, text: '手机' },
                { start: 18, end: 20, text: '手机' },
              ],
            },
          ],
        },
      ]

      const diff = buildVisualDiff(docNodes, 'PAD')
      // 虽在侧栏结果中为 1 项，但在 Visual Diff 中细化为 2 处可独立勾选的 DiffItem
      expect(diff.totalCount).toBe(2)
      expect(diff.includedCount).toBe(2)
      expect(diff.groups[0].items).toHaveLength(2)
      expect(diff.groups[0].items[0].matchedText).toBe('手机')
      expect(diff.groups[0].items[0].replacedText).toBe('PAD')
      expect(diff.groups[0].items[1].matchedText).toBe('手机')
      expect(diff.groups[0].items[1].replacedText).toBe('PAD')
    })
  })
})
