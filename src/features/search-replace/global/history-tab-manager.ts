import type { App as VueApp } from 'vue'
import { createApp } from 'vue'
import { openTab } from 'siyuan'
import { getPluginInstance } from '@/plugin-instance'
import ReplaceHistoryTabView from './ui/ReplaceHistoryTabView.vue'
import { SEARCH_REPLACE_TOP_BAR_ICON_ID } from '@/icons'

export const REPLACE_HISTORY_TAB_TYPE = 'siyuan-sou-easy-replace-history-tab'

const tabApps = new WeakMap<HTMLElement, VueApp>()

/**
 * 初始化并挂载替换历史分屏页签视图
 */
export function initReplaceHistoryTab(element: HTMLElement) {
  const container = document.createElement('div')
  container.className = 'sfsr-history-tab-container'
  container.style.height = '100%'
  container.style.width = '100%'
  container.style.display = 'flex'
  container.style.flexDirection = 'column'
  container.style.overflow = 'hidden'

  element.innerHTML = ''
  element.appendChild(container)

  const app = createApp(ReplaceHistoryTabView)
  app.mount(container)
  tabApps.set(element, app)
}

/**
 * 卸载替换历史分屏页签视图
 */
export function destroyReplaceHistoryTab(element: HTMLElement) {
  const app = tabApps.get(element)
  if (app) {
    app.unmount()
    tabApps.delete(element)
  }
  element.innerHTML = ''
}

/**
 * 在分屏页签打开替换历史（与当前编辑区并排显示，便于核对）
 */
export async function openReplaceHistoryTab(position: 'right' | 'bottom' = 'right') {
  const plugin = getPluginInstance()
  if (!plugin?.app) {
    return
  }

  await openTab({
    app: plugin.app,
    custom: {
      id: plugin.name + REPLACE_HISTORY_TAB_TYPE,
      icon: SEARCH_REPLACE_TOP_BAR_ICON_ID,
      title: '批量替换历史与回退',
    },
    position, // 在右侧分屏打开，与当前编辑区并排显示
  })
}
