import type { GlobalMatchSnippet } from '@/features/search-replace/global/types'
import { openTab } from 'siyuan'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  navigateToGlobalMatch,
  scrollAndHighlightBlock,
} from '@/features/search-replace/global/store'
import * as kernel from '@/features/search-replace/kernel'
import { setPluginInstance } from '@/plugin-instance'

describe('global search match navigation and full-document highlighting', () => {
  let mockPlugin: any

  beforeEach(() => {
    vi.useFakeTimers()
    mockPlugin = {
      app: {
        plugins: [],
      },
    }
    setPluginInstance(mockPlugin)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    setPluginInstance(null as any)
    document.body.innerHTML = ''
  })

  describe('scrollAndHighlightBlock', () => {
    it('scrolls block into view, focuses editable element and manages highlight animation class lifecycle', () => {
      const blockEl = document.createElement('div')
      blockEl.setAttribute('data-node-id', 'test-p-1')
      const editableEl = document.createElement('div')
      editableEl.setAttribute('contenteditable', 'true')
      blockEl.appendChild(editableEl)
      document.body.appendChild(blockEl)

      blockEl.scrollIntoView = vi.fn()
      editableEl.focus = vi.fn()

      scrollAndHighlightBlock(blockEl, true)

      expect(blockEl.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
      })
      expect(editableEl.focus).toHaveBeenCalled()
      expect(blockEl.classList.contains('sfsr-block-target-highlight')).toBe(true)

      // 2200ms 后高亮类安全移除
      vi.advanceTimersByTime(2200)
      expect(blockEl.classList.contains('sfsr-block-target-highlight')).toBe(false)
    })
  })

  describe('navigateToGlobalMatch', () => {
    it('uses full-document actions (cb-get-context, cb-get-rootscroll, cb-get-hl, cb-get-focus) and never cb-get-all for regular blocks', async () => {
      const match: GlobalMatchSnippet = {
        matchId: 'doc-1:p-1:0',
        blockId: 'p-1',
        rootId: 'doc-1',
        blockType: 'p',
        matchedText: '关键词',
        prefixText: '前文',
        suffixText: '后文',
        previewText: '前文关键词后文',
        segments: [],
        fullContent: '前文关键词后文',
        sort: 0,
        updated: '20261023120000',
        created: '20261023120000',
        hpath: '/知识库/测试文档',
        box: 'box-1',
        selectedForReplace: true,
        startOffset: 2,
        endOffset: 5,
      }

      await navigateToGlobalMatch(match)

      expect(openTab).toHaveBeenCalledTimes(1)
      const openTabCall = (openTab as any).mock.calls[0][0]
      expect(openTabCall.doc.id).toBe('p-1')
      // 验证包含完整上下文与根文档滚动定位 actions
      expect(openTabCall.doc.action).toContain('cb-get-context')
      expect(openTabCall.doc.action).toContain('cb-get-rootscroll')
      expect(openTabCall.doc.action).toContain('cb-get-hl')
      expect(openTabCall.doc.action).toContain('cb-get-focus')
      // 严禁包含 cb-get-all（避免退化为 ZoomIn 聚焦单块模式）
      expect(openTabCall.doc.action).not.toContain('cb-get-all')
    })

    it('omits cb-get-focus for table blocks to prevent cursor lock, while preserving full-document context', async () => {
      const match: GlobalMatchSnippet = {
        matchId: 'doc-1:t-1:0',
        blockId: 't-1',
        rootId: 'doc-1',
        blockType: 't',
        tableRowIndex: 2,
        tableRowText: '行内容',
        matchedText: '表格词',
        prefixText: '',
        suffixText: '',
        previewText: '表格词',
        segments: [],
        fullContent: '表格词',
        sort: 0,
        updated: '20261023120000',
        created: '20261023120000',
        hpath: '/知识库/测试表格',
        box: 'box-1',
        selectedForReplace: true,
        startOffset: 0,
        endOffset: 3,
      }

      await navigateToGlobalMatch(match)

      expect(openTab).toHaveBeenCalledTimes(1)
      const openTabCall = (openTab as any).mock.calls[0][0]
      expect(openTabCall.doc.action).toContain('cb-get-context')
      expect(openTabCall.doc.action).toContain('cb-get-rootscroll')
      expect(openTabCall.doc.action).toContain('cb-get-hl')
      expect(openTabCall.doc.action).not.toContain('cb-get-focus')
    })

    it('performs in-place scroll and highlight without openTab when block is already visible in active editor', async () => {
      // 模拟已在激活窗口中渲染该目标块
      const activeWnd = document.createElement('div')
      activeWnd.className = 'layout__wnd--active'
      const protyle = document.createElement('div')
      protyle.className = 'protyle'
      const targetBlock = document.createElement('div')
      targetBlock.setAttribute('data-node-id', 'p-visible-1')
      targetBlock.scrollIntoView = vi.fn()
      protyle.appendChild(targetBlock)
      activeWnd.appendChild(protyle)
      document.body.appendChild(activeWnd)

      // jsdom 中 offsetParent 默认为 null，模拟真实可见性
      Object.defineProperty(targetBlock, 'offsetParent', {
        configurable: true,
        get: () => document.body,
      })

      const match: GlobalMatchSnippet = {
        matchId: 'doc-1:p-visible-1:0',
        blockId: 'p-visible-1',
        rootId: 'doc-1',
        blockType: 'p',
        matchedText: '搜索词',
        prefixText: '',
        suffixText: '',
        previewText: '搜索词',
        segments: [],
        fullContent: '搜索词',
        sort: 0,
        updated: '20261023120000',
        created: '20261023120000',
        hpath: '/测试',
        box: 'box-1',
        selectedForReplace: true,
        startOffset: 0,
        endOffset: 3,
      }

      await navigateToGlobalMatch(match)

      // 目标块已在当前活动页面可见，绝对不调用 openTab 重新挂载
      expect(openTab).not.toHaveBeenCalled()
      expect(targetBlock.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
      })
      expect(targetBlock.classList.contains('sfsr-block-target-highlight')).toBe(true)
    })

    it('unfolds parent heading when the target block is folded', async () => {
      const checkFoldSpy = vi.spyOn(kernel, 'checkBlockFold').mockResolvedValue({
        isFolded: true,
        isRoot: false,
      })
      const unfoldSpy = vi.spyOn(kernel, 'unfoldBlock').mockResolvedValue({} as any)

      const match: GlobalMatchSnippet = {
        matchId: 'doc-1:folded-1:0',
        blockId: 'folded-1',
        rootId: 'doc-1',
        blockType: 'p',
        matchedText: '折叠内容',
        prefixText: '',
        suffixText: '',
        previewText: '折叠内容',
        segments: [],
        fullContent: '折叠内容',
        sort: 0,
        updated: '20261023120000',
        created: '20261023120000',
        hpath: '/测试折叠',
        box: 'box-1',
        selectedForReplace: true,
        startOffset: 0,
        endOffset: 4,
      }

      await navigateToGlobalMatch(match)

      expect(checkFoldSpy).toHaveBeenCalledWith('folded-1')
      expect(unfoldSpy).toHaveBeenCalledWith('folded-1')
      expect(openTab).toHaveBeenCalledTimes(1)
    })
  })
})
