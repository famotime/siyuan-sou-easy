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
  goPrev,
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
describe('store context: approximate scroll & boundary nudge', () => {
  beforeEach(() => {
    resetStoreContextTest()
  })

  afterEach(async () => {
    await teardownStoreContextTest()
  })

  it('pushes the viewport to the current lazy-load boundary when the target match is beyond the loaded block range', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="block-1" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    let scrollTop = 0

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
    scrollContainer.scrollTo = vi.fn(({ top }: { top?: number }) => {
      scrollTop = top ?? scrollTop
    }) as any

    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match) => {
      if (match?.id === 'block-8:0:3') {
        return 'missing'
      }

      return 'visible'
    })

    searchReplaceState.visible = true
    searchReplaceState.matches = [
      {
        blockId: 'block-1',
        blockIndex: 0,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-1:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
        occ: 0,
      },
      {
        blockId: 'block-8',
        blockIndex: 7,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-8:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
        occ: 0,
      },
    ]
    searchReplaceState.currentIndex = 0
    searchReplaceState.searchableBlockCount = 10
    searchReplaceState.minimapBlocks = Array.from({ length: 10 }, (_, index) => ({
      blockId: `block-${index + 1}`,
      blockIndex: index,
      blockType: 'NodeParagraph',
    }))

    goNext()

    expect(searchReplaceState.currentIndex).toBe(1)
    expect(scrollContainer.scrollTo).toHaveBeenCalled()
    expect(scrollTop).toBe(900)
  })

  it('uses the currently visible loaded block range instead of sparse offscreen blocks when approximating navigation', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="block-1" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-4" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-5" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-10" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    const loadedBlocks = Array.from(document.querySelectorAll<HTMLElement>('.protyle-wysiwyg [data-node-id][data-type]'))
    let scrollTop = 0

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

    vi.spyOn(loadedBlocks[0]!, 'getBoundingClientRect').mockReturnValue({
      bottom: 80,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 40,
      width: 320,
      x: 0,
      y: 40,
    })
    vi.spyOn(loadedBlocks[1]!, 'getBoundingClientRect').mockReturnValue({
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
    vi.spyOn(loadedBlocks[2]!, 'getBoundingClientRect').mockReturnValue({
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
    vi.spyOn(loadedBlocks[3]!, 'getBoundingClientRect').mockReturnValue({
      bottom: 620,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 580,
      width: 320,
      x: 0,
      y: 580,
    })

    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match) => {
      if (match?.id === 'block-8:0:3') {
        return 'missing'
      }

      return 'visible'
    })

    searchReplaceState.visible = true
    searchReplaceState.matches = [
      {
        blockId: 'block-4',
        blockIndex: 3,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-4:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
        occ: 0,
      },
      {
        blockId: 'block-8',
        blockIndex: 7,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-8:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
        occ: 0,
      },
    ]
    searchReplaceState.currentIndex = 0
    searchReplaceState.searchableBlockCount = 10
    searchReplaceState.minimapBlocks = Array.from({ length: 10 }, (_, index) => ({
      blockId: `block-${index + 1}`,
      blockIndex: index,
      blockType: 'NodeParagraph',
    }))

    goNext()

    expect(searchReplaceState.currentIndex).toBe(1)
    expect(scrollContainer.scrollTo).toHaveBeenCalled()
    expect(scrollTop).toBe(900)
  })

  it('uses the centered visible loaded segment instead of a sparse visible min-max range when the target block is still missing', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="block-4" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-5" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-11" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    const loadedBlocks = Array.from(document.querySelectorAll<HTMLElement>('.protyle-wysiwyg [data-node-id][data-type]'))
    let scrollTop = 0

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

    vi.spyOn(loadedBlocks[0]!, 'getBoundingClientRect').mockReturnValue({
      bottom: 210,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 170,
      width: 320,
      x: 0,
      y: 170,
    })
    vi.spyOn(loadedBlocks[1]!, 'getBoundingClientRect').mockReturnValue({
      bottom: 270,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 230,
      width: 320,
      x: 0,
      y: 230,
    })
    vi.spyOn(loadedBlocks[2]!, 'getBoundingClientRect').mockReturnValue({
      bottom: 390,
      height: 40,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 350,
      width: 320,
      x: 0,
      y: 350,
    })

    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match) => {
      if (match?.id === 'block-7:0:3') {
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
        blockId: 'block-7',
        blockIndex: 6,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-7:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
        occ: 0,
      },
    ]
    searchReplaceState.currentIndex = 0
    searchReplaceState.searchableBlockCount = 12
    searchReplaceState.minimapBlocks = Array.from({ length: 12 }, (_, index) => ({
      blockId: `block-${index + 1}`,
      blockIndex: index,
      blockType: 'NodeParagraph',
    }))

    goNext()

    expect(searchReplaceState.currentIndex).toBe(1)
    expect(scrollContainer.scrollTo).toHaveBeenCalled()
    expect(scrollTop).toBe(900)
  })

  it('nudges the upper lazy-load boundary when retries stay pinned at scrollTop 0', async () => {
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
    let scrollTop = 0
    let directScrollAttempts = 0
    let nudgedAwayFromBoundary = false
    let boundaryStimulated = false
    const scrollPositions: number[] = []

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
        scrollPositions.push(value)
        if (value === 1 && scrollTop === 0) {
          nudgedAwayFromBoundary = true
        }
        if (value === 0 && nudgedAwayFromBoundary) {
          boundaryStimulated = true
        }
        scrollTop = value
      },
    })
    scrollContainer.scrollTo = vi.fn(({ top }: { top?: number }) => {
      if (typeof top === 'number') {
        scrollTop = top
      }
    }) as any

    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match, mode) => {
      if (match?.id === 'block-1:0:3') {
        if (mode === 'if-needed') {
          return 'missing'
        }

        directScrollAttempts += 1
        return boundaryStimulated && directScrollAttempts >= 2 ? 'scrolled' : 'missing'
      }

      return 'visible'
    })
    editorMocks.isMatchVisible.mockImplementation((_context, match) => {
      if (match?.id !== 'block-1:0:3') {
        return true
      }

      return boundaryStimulated && directScrollAttempts >= 2
    })

    searchReplaceState.visible = true
    searchReplaceState.matches = [
      {
        blockId: 'block-1',
        blockIndex: 0,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-1:0:3',
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
    searchReplaceState.currentIndex = 1
    searchReplaceState.searchableBlockCount = 100
    searchReplaceState.minimapBlocks = Array.from({ length: 100 }, (_, index) => ({
      blockId: `block-${index + 1}`,
      blockIndex: index,
      blockType: 'NodeParagraph',
    }))

    goPrev()

    expect(searchReplaceState.currentIndex).toBe(0)
    expect(searchReplaceState.navigationHint).toContain('等待内容加载')

    await vi.advanceTimersByTimeAsync(120)

    expect(searchReplaceState.navigationHint).toBe('')
    expect(scrollPositions).toContain(1)
    expect(scrollTop).toBe(0)
  })

  it('nudges the lower lazy-load boundary when the container reaches max scrollTop and then snaps back', async () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content protyle-content--transition">
          <div class="protyle-wysiwyg">
            <div data-node-id="block-40" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    let scrollTop = 450
    let directScrollAttempts = 0
    let nudgedAwayFromBoundary = false
    let boundaryStimulated = false
    const scrollPositions: number[] = []

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
        scrollPositions.push(value)
        if (value === 899 && scrollTop === 900) {
          nudgedAwayFromBoundary = true
        }
        if (value === 900 && nudgedAwayFromBoundary) {
          boundaryStimulated = true
        }
        scrollTop = value
      },
    })
    scrollContainer.scrollTo = vi.fn(({ top }: { top?: number }) => {
      if (typeof top === 'number') {
        scrollTop = top
        if (top === 900 && !boundaryStimulated) {
          window.setTimeout(() => {
            if (!boundaryStimulated) {
              scrollTop = 450
            }
          }, 0)
        }
      }
    }) as any

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

        directScrollAttempts += 1
        return boundaryStimulated && directScrollAttempts >= 2 ? 'scrolled' : 'missing'
      }

      return 'visible'
    })
    editorMocks.isMatchVisible.mockImplementation((_context, match) => {
      if (match?.id !== 'block-80:0:3') {
        return true
      }

      return boundaryStimulated && directScrollAttempts >= 2
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
    expect(searchReplaceState.navigationHint).toContain('等待内容加载')

    await vi.advanceTimersByTimeAsync(120)

    expect(searchReplaceState.navigationHint).toBe('')
    expect(scrollPositions).toContain(899)
    expect(scrollTop).toBe(900)
  })

})
