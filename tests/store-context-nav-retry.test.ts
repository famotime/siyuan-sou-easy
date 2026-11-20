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
  goNext,
  goPrev,
  searchReplaceState,
} from '@/features/search-replace/store'
import { setPluginInstance } from '@/plugin-instance'
import {
  resetStoreContextTest,
  teardownStoreContextTest,
} from './helpers/store-context-lifecycle'
import {
  editorMocks,
  kernelMocks,
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
describe('store context: long-document navigation retry & native nav', () => {
  beforeEach(() => {
    resetStoreContextTest()
  })

  afterEach(async () => {
    await teardownStoreContextTest()
  })

  it('keeps navigating toward unloaded long-document matches and shows a loading hint until the target block is available', async () => {
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
    let targetLoaded = false

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
        // Simulate a container that reports scroll metrics but ignores local scroll position updates.
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
        return targetLoaded ? 'scrolled' : 'missing'
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
    expect(searchReplaceState.navigationHint).toContain('等待内容加载')
    expect(scrollContainer.scrollTo).toHaveBeenCalled()
    expect(scrollTop).toBeGreaterThan(0)

    targetLoaded = true
    await vi.runAllTimersAsync()

    expect(searchReplaceState.navigationHint).toBe('')
  })

  it('keeps retrying long-document navigation when the lazy-load boundary is still advancing', async () => {
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
    let lazyLoadStep = 0

    Object.defineProperty(scrollContainer, 'clientHeight', {
      configurable: true,
      value: 300,
    })
    Object.defineProperty(scrollContainer, 'scrollHeight', {
      configurable: true,
      get: () => 1200 + (lazyLoadStep * 30),
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
      lazyLoadStep += 1
    }) as any

    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match) => {
      if (match?.id === 'block-80:0:3') {
        return lazyLoadStep >= 45 ? 'scrolled' : 'missing'
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
    expect(searchReplaceState.navigationHint).toContain('等待内容加载')

    await vi.advanceTimersByTimeAsync(45 * 120)

    expect(lazyLoadStep).toBeGreaterThanOrEqual(45)
    expect(searchReplaceState.navigationHint).toBe('')
    expect(editorMocks.scrollMatchIntoView).toHaveBeenCalledTimes(47)
  })

  it('keeps retrying forward navigation while waiting at the lower lazy-load boundary', async () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="block-6" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    let scrollTop = 900
    let directScrollAttempts = 0

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
        return directScrollAttempts >= 45 ? 'scrolled' : 'missing'
      }

      return 'visible'
    })
    editorMocks.isMatchVisible.mockImplementation((_context, match) => {
      if (match?.id !== 'block-80:0:3') {
        return true
      }

      return directScrollAttempts >= 45
    })

    searchReplaceState.visible = true
    searchReplaceState.matches = [
      {
        blockId: 'block-6',
        blockIndex: 5,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-6:0:3',
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

    await vi.advanceTimersByTimeAsync(45 * 120)

    expect(searchReplaceState.navigationHint).toBe('')
    expect(editorMocks.scrollMatchIntoView).toHaveBeenCalledTimes(46)
    expect(scrollContainer.scrollTo).toHaveBeenCalled()
    expect(scrollTop).toBe(900)
  })

  it('keeps pending navigation active until the scrolled target is actually visible', async () => {
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
    let directScrollAttempts = 0
    let visibilityChecks = 0

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

    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match, mode) => {
      if (match?.id === 'block-8:0:3') {
        if (mode === 'if-needed') {
          return 'missing'
        }

        directScrollAttempts += 1
        return directScrollAttempts === 1 ? 'missing' : 'scrolled'
      }

      return 'visible'
    })
    editorMocks.isMatchVisible.mockImplementation((_context, match) => {
      if (match?.id !== 'block-8:0:3') {
        return true
      }

      visibilityChecks += 1
      return visibilityChecks >= 2
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

    expect(searchReplaceState.navigationHint).toContain('等待内容加载')

    await vi.advanceTimersByTimeAsync(120)
    expect(searchReplaceState.navigationHint).toContain('等待内容加载')

    await vi.advanceTimersByTimeAsync(120)
    expect(searchReplaceState.navigationHint).toBe('')
    expect(editorMocks.isMatchVisible).toHaveBeenCalled()
  })

  it('does not fall back to approximate scrolling when target element is in DOM and direct scroll returns scrolled', async () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="block-1" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="block-8" data-type="NodeTable"><div contenteditable="true">foo</div></div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    let scrollTop = 8000

    Object.defineProperty(scrollContainer, 'clientHeight', {
      configurable: true,
      value: 300,
    })
    Object.defineProperty(scrollContainer, 'scrollHeight', {
      configurable: true,
      value: 10000,
    })
    Object.defineProperty(scrollContainer, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value
      },
    })
    const scrollToSpy = vi.fn(({ top }: { top?: number }) => {
      scrollTop = top ?? scrollTop
    })
    scrollContainer.scrollTo = scrollToSpy as any

    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match) => {
      if (match?.id === 'block-8:0:3') {
        return 'scrolled'
      }
      return 'visible'
    })
    editorMocks.isMatchVisible.mockReturnValue(false)

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
        blockType: 'NodeTable',
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

    expect(searchReplaceState.navigationHint).toContain('等待内容加载')

    await vi.advanceTimersByTimeAsync(120 * 6)

    expect(scrollToSpy).not.toHaveBeenCalled()
    expect(scrollTop).toBe(8000)
    expect(searchReplaceState.navigationHint).toBe('')
  })

  it('unfolds collapsed ancestor blocks before timing out pending navigation for hidden matches', async () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="block-1" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
            <div data-node-id="list-item-1" data-type="NodeListItem"><div contenteditable="true">去飞书开发者后台</div></div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    let scrollTop = 0
    let ancestorExpanded = false

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

    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    kernelMocks.unfoldBlock.mockImplementation(async (id: string) => {
      if (id === 'list-item-1') {
        ancestorExpanded = true
      }
      return null
    })
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match) => {
      if (match?.id === 'block-2:0:2') {
        return ancestorExpanded ? 'scrolled' : 'missing'
      }

      return 'visible'
    })
    editorMocks.isMatchVisible.mockImplementation((_context, match) => {
      if (match?.id !== 'block-2:0:2') {
        return true
      }

      return ancestorExpanded
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
        blockId: 'block-2',
        blockIndex: 1,
        blockType: 'NodeParagraph',
        collapsedAncestorIds: ['list-item-1'],
        end: 2,
        id: 'block-2:0:2',
        matchedText: '飞书',
        previewText: '[飞书]开放平台',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
        occ: 0,
      } as any,
    ]
    searchReplaceState.currentIndex = 0
    searchReplaceState.searchableBlockCount = 2
    searchReplaceState.minimapBlocks = [
      {
        blockId: 'block-1',
        blockIndex: 0,
        blockType: 'NodeParagraph',
      },
      {
        blockId: 'block-2',
        blockIndex: 1,
        blockType: 'NodeParagraph',
      },
    ]

    goNext()

    expect(searchReplaceState.currentIndex).toBe(1)
    expect(searchReplaceState.navigationHint).toContain('等待内容加载')
    expect(kernelMocks.unfoldBlock).toHaveBeenCalledWith('list-item-1')

    await vi.advanceTimersByTimeAsync(120)

    expect(searchReplaceState.navigationHint).toBe('')
    expect(editorMocks.scrollMatchIntoView).toHaveBeenCalledWith(
      editorMocks.state.context,
      expect.objectContaining({ id: 'block-2:0:2' }),
      'always',
    )
  })

  it('keeps retrying backward navigation while waiting at the upper lazy-load boundary', async () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            <div data-node-id="block-6" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    let scrollTop = 120
    let directScrollAttempts = 0

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
        return directScrollAttempts >= 45 ? 'scrolled' : 'missing'
      }

      return 'visible'
    })
    editorMocks.isMatchVisible.mockImplementation((_context, match) => {
      if (match?.id !== 'block-1:0:3') {
        return true
      }

      return directScrollAttempts >= 45
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
        blockId: 'block-6',
        blockIndex: 5,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-6:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
        occ: 0,
      },
    ]
    searchReplaceState.currentIndex = 1
    searchReplaceState.searchableBlockCount = 10
    searchReplaceState.minimapBlocks = Array.from({ length: 10 }, (_, index) => ({
      blockId: `block-${index + 1}`,
      blockIndex: index,
      blockType: 'NodeParagraph',
    }))

    goPrev()

    expect(searchReplaceState.currentIndex).toBe(0)
    expect(searchReplaceState.navigationHint).toContain('等待内容加载')

    await vi.advanceTimersByTimeAsync(45 * 120)

    expect(searchReplaceState.navigationHint).toBe('')
    expect(editorMocks.scrollMatchIntoView).toHaveBeenCalledTimes(46)
    expect(scrollContainer.scrollTo).toHaveBeenCalled()
    expect(scrollTop).toBe(0)
  })

  it('uses direct protyle navigation to load a far target block before approximate scrolling times out', async () => {
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
    const wysiwyg = document.querySelector<HTMLElement>('.protyle-wysiwyg')!
    const loadedBlock = document.querySelector<HTMLElement>('[data-node-id="block-40"]')!
    let scrollTop = 450
    let targetLoaded = false

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

    const updateIndex = vi.fn((_protyle: any, blockId: string) => {
      if (blockId !== 'block-80' || targetLoaded) {
        return
      }

      targetLoaded = true
      const targetBlock = document.createElement('div')
      targetBlock.dataset.nodeId = 'block-80'
      targetBlock.dataset.type = 'NodeParagraph'
      targetBlock.innerHTML = '<div contenteditable="true">foo</div>'
      wysiwyg.appendChild(targetBlock)
      vi.spyOn(targetBlock, 'getBoundingClientRect').mockReturnValue({
        bottom: 320,
        height: 40,
        left: 0,
        right: 320,
        toJSON: () => ({}),
        top: 280,
        width: 320,
        x: 0,
        y: 280,
      })
    })

    editorMocks.state.context = {
      protyle,
      protyleRef: {
        block: {
          rootID: 'root-1',
        },
        element: protyle,
        scroll: {
          updateIndex,
        },
      },
      rootId: 'root-1',
      title: 'Doc 1',
    } as any
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match, mode) => {
      if (match?.id === 'block-80:0:3') {
        if (mode === 'if-needed') {
          return 'missing'
        }

        return targetLoaded ? 'scrolled' : 'missing'
      }

      return 'visible'
    })
    editorMocks.isMatchVisible.mockImplementation((_context, match) => {
      if (match?.id !== 'block-80:0:3') {
        return true
      }

      return targetLoaded
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
    expect(updateIndex).toHaveBeenCalledTimes(1)
    expect(scrollContainer.scrollTo).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(120)

    expect(searchReplaceState.navigationHint).toBe('')
    expect(targetLoaded).toBe(true)
    expect(updateIndex).toHaveBeenCalledTimes(1)
    expect(scrollContainer.scrollTo).not.toHaveBeenCalled()
  })

  it('abandons pending navigation after repeated misses and clears the loading hint', async () => {
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
      set: (value: number) => {
        scrollTop = value
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
    expect(searchReplaceState.navigationHint).toContain('等待内容加载')

    await vi.runAllTimersAsync()

    expect(searchReplaceState.navigationHint).toBe('')
    expect(editorMocks.scrollMatchIntoView).toHaveBeenCalledTimes(41)
    expect(scrollContainer.scrollTo).toHaveBeenCalled()
  })

  it('uses native block navigation for far missing matches and resumes after the editor context returns', async () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-content">
          <div class="protyle-wysiwyg">
            ${Array.from({ length: 25 }, (_, offset) => {
              const index = 124 + offset
              return `<div data-node-id="block-${index + 1}" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>`
            }).join('')}
          </div>
        </div>
      </div>
    `

    const protyle = document.querySelector<HTMLElement>('.protyle')!
    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    let scrollTop = 7916
    let targetLoaded = false

    Object.defineProperty(scrollContainer, 'clientHeight', {
      configurable: true,
      value: 1484,
    })
    Object.defineProperty(scrollContainer, 'scrollHeight', {
      configurable: true,
      value: 23328,
    })
    Object.defineProperty(scrollContainer, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value
      },
    })
    scrollContainer.scrollTo = vi.fn(({ top }: { top?: number }) => {
      if (typeof top === 'number') {
        scrollTop = top
      }
    }) as any
    vi.spyOn(scrollContainer, 'getBoundingClientRect').mockReturnValue({
      bottom: 1484,
      height: 1484,
      left: 0,
      right: 1280,
      toJSON: () => ({}),
      top: 0,
      width: 1280,
      x: 0,
      y: 0,
    })
    document.querySelectorAll<HTMLElement>('[data-node-id][data-type]').forEach((element, offset) => {
      const top = offset * 40
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
        bottom: top + 36,
        height: 36,
        left: 0,
        right: 800,
        toJSON: () => ({}),
        top,
        width: 800,
        x: 0,
        y: top,
      })
    })

    editorMocks.state.context = {
      protyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.state.contextAvailable = true
    editorMocks.scrollMatchIntoView.mockImplementation((_context, match) => {
      if (match?.id === 'block-564:0:3') {
        return targetLoaded ? 'scrolled' : 'missing'
      }

      return 'visible'
    })
    editorMocks.isMatchVisible.mockImplementation((_context, match) => {
      if (match?.id === 'block-564:0:3') {
        return targetLoaded
      }

      return true
    })
    setPluginInstance({
      app: { layout: {} },
      i18n: {},
    } as any)

    searchReplaceState.visible = true
    searchReplaceState.query = 'foo'
    searchReplaceState.matches = [
      {
        blockId: 'block-126',
        blockIndex: 125,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-126:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
        occ: 0,
      },
      {
        blockId: 'block-564',
        blockIndex: 563,
        blockType: 'NodeParagraph',
        end: 3,
        id: 'block-564:0:3',
        matchedText: 'foo',
        previewText: '[foo]',
        replaceable: true,
        rootId: 'root-1',
        start: 0,
        occ: 0,
      },
    ]
    searchReplaceState.currentIndex = 0
    searchReplaceState.searchableBlockCount = 600
    searchReplaceState.minimapBlocks = Array.from({ length: 600 }, (_, index) => ({
      blockId: `block-${index + 1}`,
      blockIndex: index,
      blockType: 'NodeParagraph',
    }))

    goNext()

    expect(searchReplaceState.currentIndex).toBe(1)
    expect(openTab).toHaveBeenCalledTimes(1)
    expect(openTab).toHaveBeenCalledWith(expect.objectContaining({
      app: expect.any(Object),
      doc: expect.objectContaining({
        action: [
          'cb-get-html',
          'cb-get-hl',
          'cb-get-focus',
          'cb-get-unchangeid',
          'cb-get-before',
          'cb-get-append',
        ],
        id: 'block-564',
      }),
      openNewTab: false,
      removeCurrentTab: true,
    }))
    expect(searchReplaceState.navigationHint).toContain('等待内容加载')

    editorMocks.state.contextAvailable = false
    await vi.advanceTimersByTimeAsync(360)

    expect(openTab).toHaveBeenCalledTimes(1)
    expect(searchReplaceState.navigationHint).toContain('等待内容加载')

    const restoredProtyle = protyle.cloneNode(true) as HTMLElement
    const restoredContent = restoredProtyle.querySelector<HTMLElement>('.protyle-wysiwyg')!
    restoredContent.innerHTML = `
      <div data-node-id="block-564" data-type="NodeParagraph"><div contenteditable="true">foo</div></div>
    `
    const restoredTarget = restoredContent.querySelector<HTMLElement>('[data-node-id="block-564"]')!
    vi.spyOn(restoredTarget, 'getBoundingClientRect').mockReturnValue({
      bottom: 640,
      height: 36,
      left: 0,
      right: 800,
      toJSON: () => ({}),
      top: 604,
      width: 800,
      x: 0,
      y: 604,
    })
    const restoredScrollContainer = restoredProtyle.querySelector<HTMLElement>('.protyle-content')!
    Object.defineProperty(restoredScrollContainer, 'clientHeight', {
      configurable: true,
      value: 1484,
    })
    Object.defineProperty(restoredScrollContainer, 'scrollHeight', {
      configurable: true,
      value: 23328,
    })
    Object.defineProperty(restoredScrollContainer, 'scrollTop', {
      configurable: true,
      get: () => 21844,
      set: () => {},
    })
    restoredScrollContainer.scrollTo = vi.fn() as any
    vi.spyOn(restoredScrollContainer, 'getBoundingClientRect').mockReturnValue({
      bottom: 1484,
      height: 1484,
      left: 0,
      right: 1280,
      toJSON: () => ({}),
      top: 0,
      width: 1280,
      x: 0,
      y: 0,
    })

    targetLoaded = true
    editorMocks.state.context = {
      protyle: restoredProtyle,
      rootId: 'root-1',
      title: 'Doc 1',
    }
    editorMocks.state.contextAvailable = true

    await vi.advanceTimersByTimeAsync(120)

    expect(searchReplaceState.navigationHint).toBe('')
    expect(openTab).toHaveBeenCalledTimes(1)
  })

})
