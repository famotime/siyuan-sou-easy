import type { App as VueApp } from 'vue'
import { createApp } from 'vue'
import { cancelActiveBatchReplace } from './replace-engine'
import {
  cancelGlobalHighlightTimers,
  globalSearchState,
} from './store'
import GlobalSearchDockView from './ui/GlobalSearchDockView.vue'

let dockApp: VueApp<Element> | null = null
let currentDockContainer: HTMLElement | null = null
let searchInputElement: HTMLInputElement | null = null
let focusSearchTimer = 0

const DOCK_TAB_SELECTOR = '[data-type="siyuan-sou-easy-dock-tab"]'

function findDockTabButton(): HTMLElement | null {
  return document.querySelector<HTMLElement>(DOCK_TAB_SELECTOR)
}

export function registerGlobalSearchInput(input: HTMLInputElement | null) {
  searchInputElement = input
}

export function initGlobalSearchDock(dockElement: HTMLElement) {
  if (dockApp) {
    dockApp.unmount()
    dockApp = null
  }

  const container = document.createElement('div')
  container.className = 'sfsr-dock-container'
  container.style.height = '100%'
  container.style.width = '100%'
  container.style.display = 'flex'
  container.style.flexDirection = 'column'

  dockElement.innerHTML = ''
  dockElement.appendChild(container)
  currentDockContainer = container

  dockApp = createApp(GlobalSearchDockView)
  dockApp.mount(container)
}

export function destroyGlobalSearchDock() {
  // Dock 销毁（含插件卸载）时中止仍在运行的批量替换批次，
  // 避免卸载后继续向内核写入变更
  cancelActiveBatchReplace()
  cancelGlobalHighlightTimers()
  window.clearTimeout(focusSearchTimer)
  if (dockApp) {
    dockApp.unmount()
    dockApp = null
  }
  currentDockContainer = null
  searchInputElement = null
}

/**
 * 判断当前全库搜索 Dock 是否已在界面上处于展开状态。
 *
 * 以思源自身维护的 tab 激活态（dock__item--active）为权威信号——
 * 思源以该 class 决定并持久化面板 show 状态（layout/dock/index.ts）。
 * 不再用 offsetParent 探测：fixed 定位祖先链会使其恒为 null。
 */
export function isGlobalSearchDockVisible(): boolean {
  if (!currentDockContainer) {
    return false
  }

  return findDockTabButton()?.classList.contains('dock__item--active') ?? false
}

/**
 * 判断当前搜索输入框是否已处于获得焦点状态
 */
export function isGlobalSearchInputFocused(): boolean {
  return document.activeElement === searchInputElement
}

/**
 * 将焦点全选放入搜索框
 */
export function focusAndSelectGlobalSearchInput() {
  if (typeof document === 'undefined') {
    return
  }
  if (!searchInputElement) {
    // 降级兜底查询
    searchInputElement = document.querySelector<HTMLInputElement>('.sfsr-dock-input')
  }

  if (searchInputElement) {
    searchInputElement.focus()
    searchInputElement.select()
  }
}

/**
 * 将焦点归还给正文活动编辑器
 */
export function returnFocusToActiveEditor() {
  try {
    const editorEl =
      document.querySelector<HTMLElement>('.layout__wnd--active .protyle-wysiwyg')
      || document.querySelector<HTMLElement>('.protyle:not(.fn__none) .protyle-wysiwyg')
      || document.querySelector<HTMLElement>('[contenteditable="true"]')

    editorEl?.focus()
  } catch (err) {
    console.warn('Failed to return focus to active editor:', err)
  }
}

/**
 * 关闭/折叠全库搜索 Dock，并将焦点归还主编辑器
 */
export function closeGlobalSearchDockAndReturnFocus() {
  const tabBtn = findDockTabButton()
  if (tabBtn && isGlobalSearchDockVisible()) {
    tabBtn.click()
  }
  returnFocusToActiveEditor()
}

/**
 * 切换（打开/收起）全库搜索 Dock，并处理选区继承与键盘流
 * @param replace 是否同时展开替换输入行
 */
export function toggleGlobalSearchDock(replace = false) {
  const tabBtn = findDockTabButton()

  // 若当前已可见且输入框已获得焦点：执行 Toggle 收起侧栏并归还焦点
  if (isGlobalSearchDockVisible() && isGlobalSearchInputFocused()) {
    closeGlobalSearchDockAndReturnFocus()
    return
  }

  // 1. 继承当前编辑器选中文本（若有选中则优先填入全库搜索框）
  const selectionText = window.getSelection()?.toString()?.trim()
  if (selectionText) {
    globalSearchState.query = selectionText
  }

  // 2. 若请求了替换模式，展开替换行
  if (replace) {
    globalSearchState.replaceVisible = true
  }

  // 3. 激活或聚焦 Dock。可见性按 {关闭, 本 tab 激活, 其他 tab 激活} 区分：
  //    本 tab 已激活时再点击 tab 按钮会被思源切换为折叠，因此只聚焦搜索框；
  //    其他 tab 激活时才点击 tabBtn 切换至本插件。
  if (isGlobalSearchDockVisible()) {
    // 本 tab 已激活，无需点击
  } else if (tabBtn) {
    tabBtn.click()
  }

  // 4. 聚焦搜索输入框（带有限重试，等待 Dock 展开动画完成）
  scheduleFocusSearchInput()
}

function scheduleFocusSearchInput(attempt = 0) {
  window.clearTimeout(focusSearchTimer)
  focusSearchTimer = window.setTimeout(() => {
    if (isGlobalSearchDockVisible()) {
      focusAndSelectGlobalSearchInput()
      return
    }

    if (attempt < 5) {
      scheduleFocusSearchInput(attempt + 1)
    }
  }, 100)
}
