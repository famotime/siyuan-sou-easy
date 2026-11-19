import type { App as VueApp } from 'vue'
import { createApp } from 'vue'
import type { Plugin } from 'siyuan'
import App from './App.vue'
import {
  getPluginInstance,
  setPluginInstance,
} from './plugin-instance'
import {
  bindPlugin,
  closePanel,
  initializeUiState,
  resetSearchReplaceState,
  unbindPlugin,
} from '@/features/search-replace/store'

let app: VueApp<Element> | null = null
let hostElement: HTMLDivElement | null = null

function resolveHostZIndex() {
  const currentZIndex = Number(window.siyuan?.zIndex)
  if (Number.isFinite(currentZIndex) && currentZIndex > 1) {
    return String(Math.floor(currentZIndex) - 1)
  }

  return '1'
}

export function getPlugin() {
  return getPluginInstance()
}

export async function init(plugin: Plugin) {
  setPluginInstance(plugin)
  bindPlugin(plugin)
  await initializeUiState()

  if (hostElement) {
    return
  }

  hostElement = document.createElement('div')
  hostElement.id = 'siyuan-friendly-search-replace'
  hostElement.className = 'sfsr-root'
  hostElement.style.zIndex = resolveHostZIndex()
  document.body.appendChild(hostElement)

  app = createApp(App)
  app.mount(hostElement)
}

export function destroy() {
  closePanel()
  unbindPlugin()
  app?.unmount()
  app = null

  if (hostElement?.parentElement) {
    hostElement.parentElement.removeChild(hostElement)
  }

  hostElement = null
  setPluginInstance(null)
  // 复位模块级会话状态：禁用→重新启用后不残留上一会话的查询词/替换词/匹配
  resetSearchReplaceState()
}
