import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const onEditorContextChanged = vi.fn()
const openPanel = vi.fn()
const openTerminalPanel = vi.fn()
const getActiveTerminalSearchSurface = vi.fn(() => null)
const isTerminalSearchTarget = vi.fn(() => false)
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
  openTerminalPanel,
  searchReplaceState: storeState,
}))

vi.mock('@/features/search-replace/terminal/registry', () => ({
  getActiveTerminalSearchSurface,
  isTerminalSearchTarget,
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
    getActiveTerminalSearchSurface.mockReturnValue(null)
    isTerminalSearchTarget.mockReturnValue(false)
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

  it('opens terminal mode when the keyboard event starts from a terminal target', async () => {
    const { openSearchReplacePanelFromKeyboardEvent } = await import('@/features/search-replace/plugin-panel-launch')
    const target = document.createElement('button')
    const surface = { id: 'terminal-1' }
    isTerminalSearchTarget.mockReturnValue(true)
    getActiveTerminalSearchSurface.mockReturnValue(surface)

    openSearchReplacePanelFromKeyboardEvent({ target } as unknown as KeyboardEvent, true)

    expect(openTerminalPanel).toHaveBeenCalledWith(surface, true)
    expect(openPanel).not.toHaveBeenCalled()
  })

  it('determines whether panel hotkey events should be ignored based on focus context', async () => {
    const { shouldIgnorePanelHotkeyEvent } = await import('@/features/search-replace/plugin-panel-launch')

    expect(shouldIgnorePanelHotkeyEvent(null)).toBe(false)

    const normalDiv = document.createElement('div')
    expect(shouldIgnorePanelHotkeyEvent(normalDiv)).toBe(false)

    // 代码编辑器内放行（Monaco / CodeMirror / ACE / data-prevent）
    const monacoContainer = document.createElement('div')
    monacoContainer.className = 'monaco-editor'
    const monacoInput = document.createElement('textarea')
    monacoInput.className = 'inputarea'
    monacoContainer.appendChild(monacoInput)
    expect(shouldIgnorePanelHotkeyEvent(monacoInput)).toBe(true)

    const cmContainer = document.createElement('div')
    cmContainer.className = 'cm-editor'
    const cmContent = document.createElement('div')
    cmContent.className = 'cm-content'
    cmContainer.appendChild(cmContent)
    expect(shouldIgnorePanelHotkeyEvent(cmContent)).toBe(true)

    const preventCustom = document.createElement('div')
    preventCustom.setAttribute('data-prevent-sou-easy', 'true')
    const innerChild = document.createElement('span')
    preventCustom.appendChild(innerChild)
    expect(shouldIgnorePanelHotkeyEvent(innerChild)).toBe(true)

    // Dialog 弹窗内（无 Protyle）放行
    const dialog = document.createElement('div')
    dialog.className = 'b3-dialog'
    const dialogInput = document.createElement('input')
    dialog.appendChild(dialogInput)
    expect(shouldIgnorePanelHotkeyEvent(dialogInput)).toBe(true)

    // Dialog 弹窗内含有 Protyle（如块预览）则不忽略
    const protyleInsideDialog = document.createElement('div')
    protyleInsideDialog.className = 'protyle'
    const protyleContent = document.createElement('div')
    protyleInsideDialog.appendChild(protyleContent)
    dialog.appendChild(protyleInsideDialog)
    expect(shouldIgnorePanelHotkeyEvent(protyleContent)).toBe(false)

    // 外部独立 input/textarea 放行
    const externalInput = document.createElement('input')
    expect(shouldIgnorePanelHotkeyEvent(externalInput)).toBe(true)

    // 搜 easy 自有面板内的 input 不由外部忽略规则拦截
    const souEasyApp = document.createElement('div')
    souEasyApp.id = 'friendly-search-replace-app'
    const panelInput = document.createElement('input')
    souEasyApp.appendChild(panelInput)
    expect(shouldIgnorePanelHotkeyEvent(panelInput)).toBe(false)
  })
})
