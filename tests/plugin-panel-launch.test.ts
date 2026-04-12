// @vitest-environment jsdom

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const onEditorContextChanged = vi.fn()
const openPanel = vi.fn()
const storeState = {
  replaceVisible: false,
  visible: false,
}
const createEditorContextFromElement = vi.fn(() => null)
const createEditorContextFromProtyleLike = vi.fn((protyle) => ({
  protyle: protyle.element,
  rootId: protyle.block?.rootID,
  title: 'Doc 1',
}))

vi.mock('@/features/search-replace/store', () => ({
  onEditorContextChanged,
  openPanel,
  searchReplaceState: storeState,
}))

vi.mock('@/features/search-replace/editor', () => ({
  createEditorContextFromElement,
  createEditorContextFromProtyleLike,
}))

describe('plugin panel launch helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeState.visible = false
    storeState.replaceVisible = false
  })

  it('opens the panel from a command and forwards the current editor context', async () => {
    const { openSearchReplacePanelFromCommand } = await import('@/features/search-replace/plugin-panel-launch')

    openSearchReplacePanelFromCommand(false, {
      block: { rootID: 'root-1' },
      element: document.createElement('div'),
    })

    expect(createEditorContextFromProtyleLike).toHaveBeenCalled()
    expect(onEditorContextChanged).toHaveBeenCalledWith(expect.objectContaining({
      rootId: 'root-1',
    }))
    expect(openPanel).toHaveBeenCalledWith(true, false)
  })

  it('keeps the panel open when the same mode is requested again', async () => {
    const { openSearchReplacePanel } = await import('@/features/search-replace/plugin-panel-launch')

    storeState.visible = true
    storeState.replaceVisible = false

    openSearchReplacePanel(false)

    expect(openPanel).toHaveBeenCalledWith(true, false)
  })

  it('switches panel modes without closing when the requested mode differs', async () => {
    const { openSearchReplacePanel } = await import('@/features/search-replace/plugin-panel-launch')

    storeState.visible = true
    storeState.replaceVisible = false

    openSearchReplacePanel(true)

    expect(openPanel).toHaveBeenCalledWith(true, true)
  })
})
