import type { App as VueApp } from 'vue'
import { createApp } from 'vue'
import GlobalSearchDockView from './ui/GlobalSearchDockView.vue'
import {
  globalSearchState,
} from './store'

let dockApp: VueApp<Element> | null = null
let currentDockContainer: HTMLElement | null = null
let searchInputElement: HTMLInputElement | null = null

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
  if (dockApp) {
    dockApp.unmount()
    dockApp = null
  }
  currentDockContainer = null
  searchInputElement = null
}

/**
 * 判断当前全库搜索 Dock 是否已在界面上处于展开且激活的可见状态
 */
export function isGlobalSearchDockVisible(): boolean {
  if (!currentDockContainer) return false
  return currentDockContainer.offsetParent !== null
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
  const tabBtn = document.querySelector<HTMLElement>('[data-type="siyuan-sou-easy-dock-tab"]')
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
  const tabBtn = document.querySelector<HTMLElement>('[data-type="siyuan-sou-easy-dock-tab"]')

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

  // 3. 激活或展开 Dock
  if (!isGlobalSearchDockVisible()) {
    if (tabBtn) {
      tabBtn.click()
    }
  } else if (tabBtn) {
    // 侧栏已打开但可能处于其他 Tab，点击 tabBtn 切换至本插件
    tabBtn.click()
  }

  // 4. 聚焦搜索输入框
  setTimeout(() => {
    focusAndSelectGlobalSearchInput()
  }, 100)
}
