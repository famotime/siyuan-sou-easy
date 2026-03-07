import type { App as VueApp } from 'vue'
import { createApp } from 'vue'
import type { Plugin } from 'siyuan'
import App from './App.vue'
import {
  bindPlugin,
  closePanel,
  initializeUiState,
} from '@/features/search-replace/store'

let pluginInstance: Plugin | null = null
let app: VueApp<Element> | null = null
let hostElement: HTMLDivElement | null = null

export function getPlugin() {
  return pluginInstance
}

export async function init(plugin: Plugin) {
  pluginInstance = plugin
  bindPlugin(plugin)
  await initializeUiState()

  if (hostElement) {
    return
  }

  hostElement = document.createElement('div')
  hostElement.id = 'siyuan-friendly-search-replace'
  hostElement.className = 'sfsr-root'
  document.body.appendChild(hostElement)

  app = createApp(App)
  app.mount(hostElement)
}

export function destroy() {
  closePanel()
  app?.unmount()
  app = null

  if (hostElement?.parentElement) {
    hostElement.parentElement.removeChild(hostElement)
  }

  hostElement = null
  pluginInstance = null
}
