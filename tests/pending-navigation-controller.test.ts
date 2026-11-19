// @vitest-environment jsdom

import type {
  EditorContext,
  SearchMatch,
} from '@/features/search-replace/types'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { createPendingNavigationController } from '@/features/search-replace/store/search-pending-navigation'
import { createInitialSearchReplaceState } from '@/features/search-replace/store/state'

const kernelMocks = vi.hoisted(() => ({
  unfoldBlock: vi.fn(),
}))

vi.mock('@/features/search-replace/kernel', () => kernelMocks)

function createMatch(overrides: Partial<SearchMatch>): SearchMatch {
  return {
    blockId: '20260101120000-abc1234',
    blockIndex: 0,
    blockType: 'NodeParagraph',
    end: 3,
    id: '20260101120000-abc1234:0:3',
    matchedText: 'foo',
    previewText: '[foo]',
    replaceable: true,
    rootId: 'root-1',
    start: 0,
    occ: 0,
    ...overrides,
  }
}

describe('pending navigation controller lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    kernelMocks.unfoldBlock.mockReset()
    kernelMocks.unfoldBlock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function createController(options: {
    isMatchVisible?: () => boolean
    scrollResult?: 'missing' | 'visible' | 'scrolled' | 'idle'
  }) {
    const state = Object.assign(createInitialSearchReplaceState(), { visible: true })
    const context = {
      protyle: document.createElement('div'),
      rootId: 'root-1',
      title: 'Doc 1',
    } as EditorContext

    const scrollMatchIntoView = vi.fn(() => options.scrollResult ?? 'scrolled')
    // mock 需返回 boolean：显式调用注入的可见性判断函数（未注入时恒为 false，与原行为一致）
    const isMatchVisible = vi.fn((): boolean => options.isMatchVisible?.() ?? false)
    const resolveEditorContext = vi.fn(() => context)

    const controller = createPendingNavigationController({
      getCurrentMatch: () => state.matches[state.currentIndex] ?? null,
      isMatchVisible,
      resolveEditorContext,
      scrollMatchIntoView,
      state,
    })

    return {
      controller,
      isMatchVisible,
      scrollMatchIntoView,
      state,
    }
  }

  it('cancels the in-flight retry chain when a new navigation begins', async () => {
    const {
      controller,
      scrollMatchIntoView,
      state,
    } = createController({})
    const match1 = createMatch({
      id: 'm1',
      blockId: 'b1',
    })
    const match2 = createMatch({
      id: 'm2',
      blockId: 'b2',
      blockIndex: 1,
    })

    state.matches = [match1, match2]

    // 建立 m1 的活跃重试链：滚动返回 'scrolled' 但不可见 → 进入 120ms 重试循环
    controller.beginPendingNavigation(match1)
    controller.retryPendingNavigation()
    expect(scrollMatchIntoView).toHaveBeenCalledTimes(1)

    // 新导航开始：旧重试链的定时器必须被清除，不得与新导航交错递增
    controller.beginPendingNavigation(match2)
    state.currentIndex = 1

    await vi.advanceTimersByTimeAsync(500)

    // 旧重试链已被清除：只有 begin(m1) 时的那一次直接滚动，未被旧定时器再次触发
    expect(scrollMatchIntoView).toHaveBeenCalledTimes(1)
  })

  it('keeps retrying after the unfold chain times out instead of hanging forever', async () => {
    // unfold 请求永不返回（内核无响应）
    kernelMocks.unfoldBlock.mockImplementation(() => new Promise(() => {}))

    const {
      controller,
      scrollMatchIntoView,
      state,
    } = createController({})
    const match1 = createMatch({
      collapsedAncestorIds: ['folded-parent-1'],
      id: 'm1',
    })

    state.matches = [match1]

    controller.beginPendingNavigation(match1)
    controller.retryPendingNavigation()

    // 展开祖先块请求已发出
    expect(kernelMocks.unfoldBlock).toHaveBeenCalledTimes(1)

    // 超时兜底（2s）后继续重试：祖先已尝试过，进入直接滚动路径（重试循环仍在推进）
    await vi.advanceTimersByTimeAsync(2500)

    expect(scrollMatchIntoView).toHaveBeenCalled()
    // unfold 请求只发出一次，不会因重试循环反复展开
    expect(kernelMocks.unfoldBlock).toHaveBeenCalledTimes(1)
  })
})
