import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  goNext,
  searchReplaceState,
} from '@/features/search-replace/store'
import {
  resetStoreContextTest,
  teardownStoreContextTest,
} from './helpers/store-context-lifecycle'
import {
  editorMocks,
} from './helpers/store-context-mocks'



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
describe('store context: scroll container fallback', () => {
  beforeEach(() => {
    resetStoreContextTest()
  })

  afterEach(async () => {
    await teardownStoreContextTest()
  })

  it('falls back to a scrollable ancestor when the protyle content container does not move', () => {
    document.body.innerHTML = `
      <div class="layout-tab-container" style="overflow: auto;">
        <div class="protyle">
          <div class="protyle-background" data-node-id="root-1"></div>
          <div class="protyle-title" data-node-id="root-1"></div>
          <input class="protyle-title__input" value="Doc 1" />
          <div class="protyle-content">
            <div class="protyle-wysiwyg">
              <div data-node-id="block-4" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
              <div data-node-id="block-5" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            </div>
          </div>
        </div>
      </div>
    `

    const hostContainer = document.querySelector<HTMLElement>('.layout-tab-container')!
    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    const loadedBlocks = Array.from(document.querySelectorAll<HTMLElement>('.protyle-wysiwyg [data-node-id][data-type]'))
    let hostScrollTop = 0
    const scrollTop = 450

    Object.defineProperty(scrollContainer, 'clientHeight', {
      configurable: true,
      value: 300,
    })
    Object.defineProperty(scrollContainer, 'scrollHeight', {
      configurable: true,
      value: 1200,
    })
    Object.defineProperty(scrollContainer, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (_value: number) => {
        // Simulate a container that ignores both scrollTo and direct scrollTop writes.
      },
    })
    scrollContainer.scrollTo = vi.fn(() => {
      // Simulate the real SiYuan issue: this container reports dimensions but does not actually scroll.
    }) as any

    Object.defineProperty(hostContainer, 'clientHeight', {
      configurable: true,
      value: 300,
    })
    Object.defineProperty(hostContainer, 'scrollHeight', {
      configurable: true,
      value: 1600,
    })
    Object.defineProperty(hostContainer, 'scrollTop', {
      configurable: true,
      get: () => hostScrollTop,
      set: (value: number) => {
        hostScrollTop = value
      },
    })
    hostContainer.scrollTo = vi.fn(({ top }: { top?: number }) => {
      hostScrollTop = top ?? hostScrollTop
    }) as any

    vi.spyOn(scrollContainer, 'getBoundingClientRect').mockReturnValue({
      bottom: 400,
      height: 300,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 100,
      width: 320,
      x: 0,
      y: 100,
    })
    vi.spyOn(hostContainer, 'getBoundingClientRect').mockReturnValue({
      bottom: 420,
      height: 300,
      left: 0,
      right: 360,
      toJSON: () => ({}),
      top: 120,
      width: 360,
      x: 0,
      y: 120,
    })
    vi.spyOn(loadedBlocks[0]!, 'getBoundingClientRect').mockReturnValue({
      bottom: 220,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 180,
      width: 320,
      x: 0,
      y: 180,
    })
    vi.spyOn(loadedBlocks[1]!, 'getBoundingClientRect').mockReturnValue({
      bottom: 280,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 240,
      width: 320,
      x: 0,
      y: 240,
    })

    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match) => {
      if (match?.id === 'block-80:0:3') {
        return 'missing'
      }

      return 'visible'
    })

    searchReplaceState.visible = true
    searchReplaceState.matches = [
      {
        blockId: 'block-5',
        blockIndex: 4,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-5:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
        occ: 0,
      },
      {
        blockId: 'block-80',
        blockIndex: 79,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-80:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
        occ: 0,
      },
    ]
    searchReplaceState.currentIndex = 0
    searchReplaceState.searchableBlockCount = 100
    searchReplaceState.minimapBlocks = Array.from({ length: 100 }, (_, index) => ({
      blockId: `block-${index + 1}`,
      blockIndex: index,
      blockType: 'NodeParagraph',
    }))

    goNext()

    expect(searchReplaceState.currentIndex).toBe(1)
    expect(scrollContainer.scrollTo).toHaveBeenCalled()
    expect(hostContainer.scrollTo).toHaveBeenCalled()
    expect(hostScrollTop).toBe(1300)
  })

  it('prefers a stable ancestor over a transition content container that snaps back after scroll', async () => {
    document.body.innerHTML = `
      <div class="layout-tab-container" style="overflow: auto;">
        <div class="protyle">
          <div class="protyle-background" data-node-id="root-1"></div>
          <div class="protyle-title" data-node-id="root-1"></div>
          <input class="protyle-title__input" value="Doc 1" />
          <div class="protyle-content protyle-content--transition">
            <div class="protyle-wysiwyg">
              <div data-node-id="block-4" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
              <div data-node-id="block-5" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            </div>
          </div>
        </div>
      </div>
    `

    const hostContainer = document.querySelector<HTMLElement>('.layout-tab-container')!
    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    const loadedBlocks = Array.from(document.querySelectorAll<HTMLElement>('.protyle-wysiwyg [data-node-id][data-type]'))
    let hostScrollTop = 0
    let transitionScrollTop = 450

    Object.defineProperty(scrollContainer, 'clientHeight', {
      configurable: true,
      value: 300,
    })
    Object.defineProperty(scrollContainer, 'scrollHeight', {
      configurable: true,
      value: 1200,
    })
    Object.defineProperty(scrollContainer, 'scrollTop', {
      configurable: true,
      get: () => transitionScrollTop,
      set: (value: number) => {
        transitionScrollTop = value
        window.setTimeout(() => {
          transitionScrollTop = 450
        }, 0)
      },
    })
    scrollContainer.scrollTo = vi.fn(({ top }: { top?: number }) => {
      transitionScrollTop = top ?? transitionScrollTop
      window.setTimeout(() => {
        transitionScrollTop = 450
      }, 0)
    }) as any

    Object.defineProperty(hostContainer, 'clientHeight', {
      configurable: true,
      value: 300,
    })
    Object.defineProperty(hostContainer, 'scrollHeight', {
      configurable: true,
      value: 1600,
    })
    Object.defineProperty(hostContainer, 'scrollTop', {
      configurable: true,
      get: () => hostScrollTop,
      set: (value: number) => {
        hostScrollTop = value
      },
    })
    hostContainer.scrollTo = vi.fn(({ top }: { top?: number }) => {
      hostScrollTop = top ?? hostScrollTop
    }) as any

    vi.spyOn(scrollContainer, 'getBoundingClientRect').mockReturnValue({
      bottom: 400,
      height: 300,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 100,
      width: 320,
      x: 0,
      y: 100,
    })
    vi.spyOn(hostContainer, 'getBoundingClientRect').mockReturnValue({
      bottom: 420,
      height: 300,
      left: 0,
      right: 360,
      toJSON: () => ({}),
      top: 120,
      width: 360,
      x: 0,
      y: 120,
    })
    vi.spyOn(loadedBlocks[0]!, 'getBoundingClientRect').mockReturnValue({
      bottom: 220,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 180,
      width: 320,
      x: 0,
      y: 180,
    })
    vi.spyOn(loadedBlocks[1]!, 'getBoundingClientRect').mockReturnValue({
      bottom: 280,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 240,
      width: 320,
      x: 0,
      y: 240,
    })

    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match, mode) => {
      if (match?.id === 'block-80:0:3') {
        if (mode === 'if-needed') {
          return 'missing'
        }

        return hostScrollTop >= 1300 ? 'scrolled' : 'missing'
      }

      return 'visible'
    })
    editorMocks.isMatchVisible.mockImplementation((_context, match) => {
      if (match?.id !== 'block-80:0:3') {
        return true
      }

      return hostScrollTop >= 1300
    })

    searchReplaceState.visible = true
    searchReplaceState.matches = [
      {
        blockId: 'block-5',
        blockIndex: 4,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-5:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
        occ: 0,
      },
      {
        blockId: 'block-80',
        blockIndex: 79,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-80:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
        occ: 0,
      },
    ]
    searchReplaceState.currentIndex = 0
    searchReplaceState.searchableBlockCount = 100
    searchReplaceState.minimapBlocks = Array.from({ length: 100 }, (_, index) => ({
      blockId: `block-${index + 1}`,
      blockIndex: index,
      blockType: 'NodeParagraph',
    }))

    goNext()

    expect(searchReplaceState.currentIndex).toBe(1)
    expect(searchReplaceState.navigationHint).toContain('等待内容加载')

    await vi.advanceTimersByTimeAsync(120)

    expect(searchReplaceState.navigationHint).toBe('')
    expect(hostContainer.scrollTo).toHaveBeenCalled()
    expect(hostScrollTop).toBe(1300)
  })

  it('falls back to directly setting scrollTop when the scroll container scrollTo call is ignored', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="block-4" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-5" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    const loadedBlocks = Array.from(document.querySelectorAll<HTMLElement>('.protyle-wysiwyg [data-node-id][data-type]'))
    let scrollTop = 450

    Object.defineProperty(scrollContainer, 'clientHeight', {
      configurable: true,
      value: 300,
    })
    Object.defineProperty(scrollContainer, 'scrollHeight', {
      configurable: true,
      value: 1200,
    })
    Object.defineProperty(scrollContainer, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value
      },
    })
    scrollContainer.scrollTo = vi.fn(() => {
      // Simulate the live SiYuan case: the method exists but does not move the element.
    }) as any

    vi.spyOn(scrollContainer, 'getBoundingClientRect').mockReturnValue({
      bottom: 400,
      height: 300,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 100,
      width: 320,
      x: 0,
      y: 100,
    })
    vi.spyOn(loadedBlocks[0]!, 'getBoundingClientRect').mockReturnValue({
      bottom: 220,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 180,
      width: 320,
      x: 0,
      y: 180,
    })
    vi.spyOn(loadedBlocks[1]!, 'getBoundingClientRect').mockReturnValue({
      bottom: 280,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 240,
      width: 320,
      x: 0,
      y: 240,
    })

    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match) => {
      if (match?.id === 'block-80:0:3') {
        return 'missing'
      }

      return 'visible'
    })

    searchReplaceState.visible = true
    searchReplaceState.matches = [
      {
        blockId: 'block-5',
        blockIndex: 4,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-5:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
        occ: 0,
      },
      {
        blockId: 'block-80',
        blockIndex: 79,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-80:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
        occ: 0,
      },
    ]
    searchReplaceState.currentIndex = 0
    searchReplaceState.searchableBlockCount = 100
    searchReplaceState.minimapBlocks = Array.from({ length: 100 }, (_, index) => ({
      blockId: `block-${index + 1}`,
      blockIndex: index,
      blockType: 'NodeParagraph',
    }))

    goNext()

    expect(searchReplaceState.currentIndex).toBe(1)
    expect(scrollContainer.scrollTo).toHaveBeenCalled()
    expect(scrollTop).toBe(900)
  })

  it('prefers the visible scroll container when multiple protyle content containers exist during transition', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content protyle-content--transition" data-container="stale">
          <div class="protyle-wysiwyg">
            <div data-node-id="block-4" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-5" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
          </div>
        </div>
        <div class="protyle-content protyle-content--transition" data-container="visible">
          <div class="protyle-wysiwyg">
            <div data-node-id="block-4" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-5" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const [staleScrollContainer, visibleScrollContainer] = Array.from(document.querySelectorAll<HTMLElement>('.protyle-content'))
    const visibleLoadedBlocks = Array.from(visibleScrollContainer!.querySelectorAll<HTMLElement>('.protyle-wysiwyg [data-node-id][data-type]'))
    let staleScrollTop = 0
    let visibleScrollTop = 450

    Object.defineProperty(staleScrollContainer!, 'clientHeight', {
      configurable: true,
      value: 300,
    })
    Object.defineProperty(staleScrollContainer!, 'scrollHeight', {
      configurable: true,
      value: 1200,
    })
    Object.defineProperty(staleScrollContainer!, 'scrollTop', {
      configurable: true,
      get: () => staleScrollTop,
      set: (value: number) => {
        staleScrollTop = value
      },
    })
    staleScrollContainer!.scrollTo = vi.fn(({ top }: { top?: number }) => {
      staleScrollTop = top ?? staleScrollTop
    }) as any

    Object.defineProperty(visibleScrollContainer!, 'clientHeight', {
      configurable: true,
      value: 300,
    })
    Object.defineProperty(visibleScrollContainer!, 'scrollHeight', {
      configurable: true,
      value: 1200,
    })
    Object.defineProperty(visibleScrollContainer!, 'scrollTop', {
      configurable: true,
      get: () => visibleScrollTop,
      set: (value: number) => {
        visibleScrollTop = value
      },
    })
    visibleScrollContainer!.scrollTo = vi.fn(({ top }: { top?: number }) => {
      visibleScrollTop = top ?? visibleScrollTop
    }) as any

    vi.spyOn(staleScrollContainer!, 'getBoundingClientRect').mockReturnValue({
      bottom: -200,
      height: 300,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: -500,
      width: 320,
      x: 0,
      y: -500,
    })
    vi.spyOn(visibleScrollContainer!, 'getBoundingClientRect').mockReturnValue({
      bottom: 400,
      height: 300,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 100,
      width: 320,
      x: 0,
      y: 100,
    })
    vi.spyOn(visibleLoadedBlocks[0]!, 'getBoundingClientRect').mockReturnValue({
      bottom: 220,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 180,
      width: 320,
      x: 0,
      y: 180,
    })
    vi.spyOn(visibleLoadedBlocks[1]!, 'getBoundingClientRect').mockReturnValue({
      bottom: 280,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 240,
      width: 320,
      x: 0,
      y: 240,
    })

    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match) => {
      if (match?.id === 'block-80:0:3') {
        return 'missing'
      }

      return 'visible'
    })

    searchReplaceState.visible = true
    searchReplaceState.matches = [
      {
        blockId: 'block-5',
        blockIndex: 4,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-5:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
        occ: 0,
      },
      {
        blockId: 'block-80',
        blockIndex: 79,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-80:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
        occ: 0,
      },
    ]
    searchReplaceState.currentIndex = 0
    searchReplaceState.searchableBlockCount = 100
    searchReplaceState.minimapBlocks = Array.from({ length: 100 }, (_, index) => ({
      blockId: `block-${index + 1}`,
      blockIndex: index,
      blockType: 'NodeParagraph',
    }))

    goNext()

    expect(searchReplaceState.currentIndex).toBe(1)
    expect(visibleScrollContainer!.scrollTo).toHaveBeenCalled()
    expect(visibleScrollTop).toBe(900)
    expect(staleScrollTop).toBe(0)
  })

  it('uses the visible wysiwyg root when a transition content container still contains a stale root', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content protyle-content--transition">
          <div class="protyle-wysiwyg" data-root="stale">
            <div data-node-id="block-1" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-2" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-3" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-4" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-5" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
          </div>
          <div class="protyle-wysiwyg" data-root="visible">
            <div data-node-id="block-70" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-71" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-72" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-73" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-74" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    const [staleRoot, visibleRoot] = Array.from(document.querySelectorAll<HTMLElement>('.protyle-wysiwyg'))
    const staleBlocks = Array.from(staleRoot!.querySelectorAll<HTMLElement>('[data-node-id][data-type]'))
    const visibleBlocks = Array.from(visibleRoot!.querySelectorAll<HTMLElement>('[data-node-id][data-type]'))
    let scrollTop = 450

    Object.defineProperty(scrollContainer, 'clientHeight', {
      configurable: true,
      value: 300,
    })
    Object.defineProperty(scrollContainer, 'scrollHeight', {
      configurable: true,
      value: 1200,
    })
    Object.defineProperty(scrollContainer, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value
      },
    })
    scrollContainer.scrollTo = vi.fn(({ top }: { top?: number }) => {
      scrollTop = top ?? scrollTop
    }) as any

    vi.spyOn(scrollContainer, 'getBoundingClientRect').mockReturnValue({
      bottom: 400,
      height: 300,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 100,
      width: 320,
      x: 0,
      y: 100,
    })
    vi.spyOn(staleRoot!, 'getBoundingClientRect').mockReturnValue({
      bottom: -100,
      height: 220,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: -320,
      width: 320,
      x: 0,
      y: -320,
    })
    vi.spyOn(visibleRoot!, 'getBoundingClientRect').mockReturnValue({
      bottom: 380,
      height: 220,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 160,
      width: 320,
      x: 0,
      y: 160,
    })

    staleBlocks.forEach((block, index) => {
      vi.spyOn(block, 'getBoundingClientRect').mockReturnValue({
        bottom: 250 + (index * 20),
        height: 40,
        left: 0,
        right: 320,
        toJSON: () => ({}),
        top: 210 + (index * 20),
        width: 320,
        x: 0,
        y: 210 + (index * 20),
      })
    })
    visibleBlocks.forEach((block, index) => {
      vi.spyOn(block, 'getBoundingClientRect').mockReturnValue({
        bottom: 340 + (index * 20),
        height: 40,
        left: 0,
        right: 320,
        toJSON: () => ({}),
        top: 300 + (index * 20),
        width: 320,
        x: 0,
        y: 300 + (index * 20),
      })
    })

    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match) => {
      if (match?.id === 'block-40:0:3') {
        return 'missing'
      }

      return 'visible'
    })

    searchReplaceState.visible = true
    searchReplaceState.matches = [
      {
        blockId: 'block-72',
        blockIndex: 71,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-72:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
        occ: 0,
      },
      {
        blockId: 'block-40',
        blockIndex: 39,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-40:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
        occ: 0,
      },
    ]
    searchReplaceState.currentIndex = 0
    searchReplaceState.searchableBlockCount = 100
    searchReplaceState.minimapBlocks = Array.from({ length: 100 }, (_, index) => ({
      blockId: `block-${index + 1}`,
      blockIndex: index,
      blockType: 'NodeParagraph',
    }))

    goNext()

    expect(searchReplaceState.currentIndex).toBe(1)
    expect(scrollContainer.scrollTo).toHaveBeenCalled()
    expect(scrollTop).toBe(0)
  })

  it('prefers the later overlapping transition wysiwyg root during pending navigation', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content protyle-content--transition">
          <div class="protyle-wysiwyg" data-root="stale">
            <div data-node-id="block-20" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-21" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-22" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-23" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-24" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
          </div>
          <div class="protyle-wysiwyg" data-root="visible">
            <div data-node-id="block-70" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-71" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-72" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-73" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-74" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    const [staleRoot, visibleRoot] = Array.from(document.querySelectorAll<HTMLElement>('.protyle-wysiwyg'))
    let scrollTop = 450

    Object.defineProperty(scrollContainer, 'clientHeight', {
      configurable: true,
      value: 300,
    })
    Object.defineProperty(scrollContainer, 'scrollHeight', {
      configurable: true,
      value: 1200,
    })
    Object.defineProperty(scrollContainer, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value
      },
    })
    scrollContainer.scrollTo = vi.fn(({ top }: { top?: number }) => {
      scrollTop = top ?? scrollTop
    }) as any

    vi.spyOn(scrollContainer, 'getBoundingClientRect').mockReturnValue({
      bottom: 400,
      height: 300,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 100,
      width: 320,
      x: 0,
      y: 100,
    })
    vi.spyOn(staleRoot!, 'getBoundingClientRect').mockReturnValue({
      bottom: 380,
      height: 220,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 160,
      width: 320,
      x: 0,
      y: 160,
    })
    vi.spyOn(visibleRoot!, 'getBoundingClientRect').mockReturnValue({
      bottom: 380,
      height: 220,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 160,
      width: 320,
      x: 0,
      y: 160,
    })

    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match) => {
      if (match?.id === 'block-40:0:3') {
        return 'missing'
      }

      return 'visible'
    })

    searchReplaceState.visible = true
    searchReplaceState.matches = [
      {
        blockId: 'block-72',
        blockIndex: 71,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-72:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
        occ: 0,
      },
      {
        blockId: 'block-40',
        blockIndex: 39,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-40:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
        occ: 0,
      },
    ]
    searchReplaceState.currentIndex = 0
    searchReplaceState.searchableBlockCount = 100
    searchReplaceState.minimapBlocks = Array.from({ length: 100 }, (_, index) => ({
      blockId: `block-${index + 1}`,
      blockIndex: index,
      blockType: 'NodeParagraph',
    }))

    goNext()

    expect(searchReplaceState.currentIndex).toBe(1)
    expect(scrollContainer.scrollTo).toHaveBeenCalled()
    expect(scrollTop).toBe(0)
  })

  it('falls back to approximate DOM scrolling when the cached protyle instance points to another editor element', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="block-40" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    const loadedBlock = document.querySelector<HTMLElement>('[data-node-id="block-40"]')!
    let scrollTop = 450

    Object.defineProperty(scrollContainer, 'clientHeight', {
      configurable: true,
      value: 300,
    })
    Object.defineProperty(scrollContainer, 'scrollHeight', {
      configurable: true,
      value: 1200,
    })
    Object.defineProperty(scrollContainer, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value
      },
    })
    scrollContainer.scrollTo = vi.fn(({ top }: { top?: number }) => {
      scrollTop = top ?? scrollTop
    }) as any

    vi.spyOn(scrollContainer, 'getBoundingClientRect').mockReturnValue({
      bottom: 400,
      height: 300,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 100,
      width: 320,
      x: 0,
      y: 100,
    })
    vi.spyOn(loadedBlock, 'getBoundingClientRect').mockReturnValue({
      bottom: 260,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 220,
      width: 320,
      x: 0,
      y: 220,
    })

    const updateIndex = vi.fn()
    const staleProtyleElement = document.createElement('div')
    editorMocks.state.context = {
      protyle,
      protyleRef: {
        block: {
          rootID: 'root-1',
        },
        element: staleProtyleElement,
        scroll: {
          updateIndex,
        },
      },
      rootId: 'root-1',
      title: 'Doc 1',
    } as any
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match) => {
      if (match?.id === 'block-80:0:3') {
        return 'missing'
      }

      return 'visible'
    })

    searchReplaceState.visible = true
    searchReplaceState.matches = [
      {
        blockId: 'block-40',
        blockIndex: 39,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-40:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
        occ: 0,
      },
      {
        blockId: 'block-80',
        blockIndex: 79,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-80:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
        occ: 0,
      },
    ]
    searchReplaceState.currentIndex = 0
    searchReplaceState.searchableBlockCount = 100
    searchReplaceState.minimapBlocks = Array.from({ length: 100 }, (_, index) => ({
      blockId: `block-${index + 1}`,
      blockIndex: index,
      blockType: 'NodeParagraph',
    }))

    goNext()

    expect(searchReplaceState.currentIndex).toBe(1)
    expect(updateIndex).not.toHaveBeenCalled()
    expect(scrollContainer.scrollTo).toHaveBeenCalled()
    expect(searchReplaceState.navigationHint).toContain('等待内容加载')
  })

})
