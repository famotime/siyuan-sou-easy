// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, h } from 'vue'
import { jumpToMatchIndex, searchReplaceState } from '@/features/search-replace/store'
import SearchToolbarRow from '@/features/search-replace/ui/SearchToolbarRow.vue'

describe('jumpToMatchIndex store action', () => {
  beforeEach(() => {
    searchReplaceState.query = 'test'
    searchReplaceState.matches = [
      { id: 'm1' } as any,
      { id: 'm2' } as any,
      { id: 'm3' } as any,
      { id: 'm4' } as any,
      { id: 'm5' } as any,
    ]
    searchReplaceState.currentIndex = 0
    searchReplaceState.sourceMode = 'document'
  })

  it('jumps to valid 1-based index', () => {
    jumpToMatchIndex(3)
    expect(searchReplaceState.currentIndex).toBe(2)

    jumpToMatchIndex(1)
    expect(searchReplaceState.currentIndex).toBe(0)

    jumpToMatchIndex(5)
    expect(searchReplaceState.currentIndex).toBe(4)
  })

  it('ignores out of bounds 1-based index', () => {
    jumpToMatchIndex(0)
    expect(searchReplaceState.currentIndex).toBe(0)

    jumpToMatchIndex(6)
    expect(searchReplaceState.currentIndex).toBe(0)

    jumpToMatchIndex(-1)
    expect(searchReplaceState.currentIndex).toBe(0)
  })

  it('does nothing when matches are empty', () => {
    searchReplaceState.matches = []
    searchReplaceState.currentIndex = 0
    jumpToMatchIndex(1)
    expect(searchReplaceState.currentIndex).toBe(0)
  })
})

describe('SearchToolbarRow editable index input', () => {
  let container: HTMLDivElement | null = null
  let app: ReturnType<typeof createApp> | null = null

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    if (app) {
      app.unmount()
      app = null
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container)
      container = null
    }
  })

  const createProps = (overrides = {}) => ({
    currentIndex: 1,
    totalMatches: 5,
    matchCase: false,
    onClose: vi.fn(),
    onFindCompositionEnd: vi.fn(),
    onFindCompositionStart: vi.fn(),
    onFindEnter: vi.fn(),
    onFindInput: vi.fn(),
    onGoNext: vi.fn(),
    onGoPrev: vi.fn(),
    onJumpToIndex: vi.fn(),
    onSelectionOnlyClick: vi.fn(),
    onSelectionOnlyPointerDown: vi.fn(),
    onToggleOption: vi.fn(),
    query: 'test',
    selectionOnly: false,
    useRegex: false,
    wholeWord: false,
    ...overrides,
  })

  function mountComponent(props: any) {
    app = createApp({
      render() {
        return h(SearchToolbarRow, props)
      },
    })
    app.mount(container!)
  }

  it('renders disabled input when totalMatches is 0', async () => {
    mountComponent(createProps({ currentIndex: 0, totalMatches: 0 }))
    await nextTick()

    const input = container!.querySelector<HTMLInputElement>('.sfsr-count__input')!
    const total = container!.querySelector<HTMLElement>('.sfsr-count__total')!

    expect(input).not.toBeNull()
    expect(input.disabled).toBe(true)
    expect(input.value).toBe('0')
    expect(total.textContent?.trim()).toBe('/ 0')
  })

  it('renders enabled input with current index and total matches', async () => {
    mountComponent(createProps({ currentIndex: 1, totalMatches: 5 }))
    await nextTick()

    const input = container!.querySelector<HTMLInputElement>('.sfsr-count__input')!
    const total = container!.querySelector<HTMLElement>('.sfsr-count__total')!

    expect(input.disabled).toBe(false)
    expect(input.value).toBe('1')
    expect(total.textContent?.trim()).toBe('/ 5')
  })

  it('triggers onJumpToIndex on Enter with valid index', async () => {
    const onJumpToIndex = vi.fn()
    mountComponent(createProps({ currentIndex: 1, totalMatches: 5, onJumpToIndex }))
    await nextTick()

    const input = container!.querySelector<HTMLInputElement>('.sfsr-count__input')!
    input.value = '4'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))
    await nextTick()

    expect(onJumpToIndex).toHaveBeenCalledWith(4)
  })

  it('restores previous index on Enter with invalid out-of-bounds input', async () => {
    const onJumpToIndex = vi.fn()
    mountComponent(createProps({ currentIndex: 2, totalMatches: 5, onJumpToIndex }))
    await nextTick()

    const input = container!.querySelector<HTMLInputElement>('.sfsr-count__input')!

    // Out of bounds upper limit
    input.value = '10'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))
    await nextTick()

    expect(onJumpToIndex).not.toHaveBeenCalled()
    expect(input.value).toBe('2')

    // Non-numeric input
    input.value = 'abc'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))
    await nextTick()

    expect(onJumpToIndex).not.toHaveBeenCalled()
    expect(input.value).toBe('2')
  })

  it('restores original index on Esc and blur', async () => {
    mountComponent(createProps({ currentIndex: 2, totalMatches: 5 }))
    await nextTick()

    const input = container!.querySelector<HTMLInputElement>('.sfsr-count__input')!

    // Esc key
    input.value = '4'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))
    await nextTick()
    expect(input.value).toBe('2')

    // Blur
    input.value = '4'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    input.dispatchEvent(new Event('blur', { bubbles: true }))
    await nextTick()
    expect(input.value).toBe('2')
  })
})
