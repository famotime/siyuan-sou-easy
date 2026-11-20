import {
  describe,
  expect,
  it,
} from 'vitest'
import { resolveApproximateScrollTop } from '@/features/search-replace/store/approximate-scroll'
import {
  computeLoadedBlockRange,
  createLoadedBlockRangeResolver,
  isTransitionScrollContainer,
  isVerticallyScrollable,
  resolveCenteredVisibleSegment,
  resolveNativeNavigationDistance,
  serializeLoadedBlockRange,
} from '@/features/search-replace/store/loaded-block-range'

// RF-104：为拆分出的 loaded-block-range / approximate-scroll 纯函数补单元特征测试，
// 钉住拆分前 search-pending-navigation.ts 的既有行为。

describe('resolveNativeNavigationDistance', () => {
  it('无已加载范围时距离为 0', () => {
    expect(resolveNativeNavigationDistance(7, null)).toBe(0)
  })

  it('目标在范围内距离为 0', () => {
    const range = {
      loadedIndexes: [2, 3, 4],
      max: 4,
      min: 2,
      source: 'all' as const,
      visibleIndexes: [],
    }
    expect(resolveNativeNavigationDistance(2, range)).toBe(0)
    expect(resolveNativeNavigationDistance(3, range)).toBe(0)
    expect(resolveNativeNavigationDistance(4, range)).toBe(0)
  })

  it('目标在上/下边界之外返回块索引差', () => {
    const range = {
      loadedIndexes: [2, 3, 4],
      max: 4,
      min: 2,
      source: 'all' as const,
      visibleIndexes: [],
    }
    expect(resolveNativeNavigationDistance(7, range)).toBe(3)
    expect(resolveNativeNavigationDistance(0, range)).toBe(2)
  })
})

describe('serializeLoadedBlockRange', () => {
  it('空范围序列化为 missing', () => {
    expect(serializeLoadedBlockRange(null)).toBe('missing')
  })

  it('按 min:max:count:source 拼接', () => {
    const range = {
      loadedIndexes: [2, 3, 4],
      max: 4,
      min: 2,
      source: 'visible-segment' as const,
      visibleIndexes: [3],
    }
    expect(serializeLoadedBlockRange(range)).toBe('2:4:3:visible-segment')
  })
})

describe('resolveCenteredVisibleSegment', () => {
  function entry(blockIndex: number, top: number, bottom: number) {
    const element = document.createElement('div')
    element.getBoundingClientRect = () => ({
      bottom,
      height: bottom - top,
      left: 0,
      right: 100,
      toJSON: () => ({}),
      top,
      width: 100,
      x: 0,
      y: top,
    } as DOMRect)
    return {
      blockIndex,
      element,
    }
  }

  const containerRect = {
    bottom: 400,
    height: 300,
    left: 0,
    right: 100,
    toJSON: () => ({}),
    top: 100,
    width: 100,
    x: 0,
    y: 100,
  } as DOMRect

  it('不连续的可见块按连续段分组，选取最接近视口中心的段', () => {
    // 容器中心 250：段 A（块 0-1，最近中心 170，距 80）；段 B（块 5-6，最近中心 290，距 40）
    const entries = [
      entry(0, 100, 160),
      entry(1, 140, 200),
      entry(5, 260, 320),
      entry(6, 300, 360),
    ]
    const segment = resolveCenteredVisibleSegment(entries, containerRect)
    expect(segment.min).toBe(5)
    expect(segment.max).toBe(6)
    expect(segment.indexes).toEqual([5, 6])
  })

  it('距离并列时取块索引更小的段', () => {
    // 段 A 中心 150、段 B 中心 350，容器中心 250 → 距离并列 100 → 取段 A
    const entries = [
      entry(0, 120, 180),
      entry(5, 320, 380),
    ]
    const segment = resolveCenteredVisibleSegment(entries, containerRect)
    expect(segment.min).toBe(0)
    expect(segment.max).toBe(0)
  })
})

describe('isVerticallyScrollable / isTransitionScrollContainer', () => {
  it('scrollHeight 不超过 clientHeight 时不可滚动', () => {
    const el = document.createElement('div')
    Object.defineProperty(el, 'scrollHeight', {
      configurable: true,
      value: 300,
    })
    Object.defineProperty(el, 'clientHeight', {
      configurable: true,
      value: 300,
    })
    expect(isVerticallyScrollable(el)).toBe(false)
  })

  it('overflowY 含 auto/scroll/hidden 时可滚动（hidden 视为可滚动是既有语义）', () => {
    const make = (overflowY: string) => {
      const el = document.createElement('div')
      Object.defineProperty(el, 'scrollHeight', {
        configurable: true,
        value: 900,
      })
      Object.defineProperty(el, 'clientHeight', {
        configurable: true,
        value: 300,
      })
      el.style.overflowY = overflowY
      return el
    }
    expect(isVerticallyScrollable(make('auto'))).toBe(true)
    expect(isVerticallyScrollable(make('hidden'))).toBe(true)
    expect(isVerticallyScrollable(make('scroll'))).toBe(true)
  })

  it('过渡容器按 class 判定', () => {
    const el = document.createElement('div')
    expect(isTransitionScrollContainer(el)).toBe(false)
    el.classList.add('protyle-content--transition')
    expect(isTransitionScrollContainer(el)).toBe(true)
    expect(isTransitionScrollContainer(null)).toBe(false)
  })
})

describe('resolveApproximateScrollTop', () => {
  const geometry = {
    clientHeight: 300,
    maxScrollTop: 900,
    scrollHeight: 1200,
  }

  it('目标在已加载范围之外时推到边界（上 0 / 下 maxScrollTop）', () => {
    const beyondMax = {
      loadedIndexes: [2, 3, 4],
      max: 4,
      min: 2,
      source: 'all' as const,
      visibleIndexes: [],
    }
    expect(resolveApproximateScrollTop(8, 10, {
      ...geometry,
      loadedBlockRange: beyondMax,
    })).toBe(900)
    expect(resolveApproximateScrollTop(0, 10, {
      ...geometry,
      loadedBlockRange: beyondMax,
    })).toBe(0)
  })

  it('目标在范围内按块索引比例居中，并夹取到 [0, maxScrollTop]', () => {
    const range = {
      loadedIndexes: [0, 1, 2],
      max: 2,
      min: 0,
      source: 'all' as const,
      visibleIndexes: [],
    }
    // (8 + 0.5) / 10 * 1200 - 150 = 870
    expect(resolveApproximateScrollTop(8, 10, {
      ...geometry,
      loadedBlockRange: null,
    })).toBe(870)
    // (0 + 0.5) / 10 * 1200 - 150 = -90 → 夹取 0
    expect(resolveApproximateScrollTop(0, 10, {
      ...geometry,
      loadedBlockRange: range,
    })).toBe(0)
  })
})

describe('createLoadedBlockRangeResolver', () => {
  it('同一容器命中缓存，clear 后重新计算', () => {
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
    const context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    const state = {
      minimapBlocks: [
        {
          blockId: 'block-1',
          blockIndex: 0,
          blockType: 'NodeParagraph',
        },
      ],
    }

    const resolver = createLoadedBlockRangeResolver(state)
    const first = resolver.resolveLoadedBlockRange(context, protyle)
    expect(first).toMatchObject({
      max: 0,
      min: 0,
      source: 'all',
    })

    // 改动 minimapBlocks 后仍命中旧缓存（同轮内缓存语义）
    state.minimapBlocks = []
    expect(resolver.resolveLoadedBlockRange(context, protyle)).toBe(first)

    resolver.clearLoadedBlockRangeCache()
    expect(resolver.resolveLoadedBlockRange(context, protyle)).toBeNull()
  })

  it('computeLoadedBlockRange 在无 minimap 块或无已加载元素时返回 null', () => {
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
    const context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    expect(computeLoadedBlockRange({ minimapBlocks: [] }, context, protyle)).toBeNull()
    expect(computeLoadedBlockRange(
      {
        minimapBlocks: [{
          blockId: 'missing',
          blockIndex: 9,
          blockType: 'NodeParagraph',
        }],
      },
      context,
      protyle,
    )).toBeNull()
  })
})
