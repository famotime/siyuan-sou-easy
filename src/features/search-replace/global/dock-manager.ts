import type { App as VueApp } from 'vue'
import { createApp } from 'vue'
import GlobalSearchDockView from './ui/GlobalSearchDockView.vue'

let dockApp: VueApp<Element> | null = null

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

  dockApp = createApp(GlobalSearchDockView)
  dockApp.mount(container)
}

export function destroyGlobalSearchDock() {
  if (dockApp) {
    dockApp.unmount()
    dockApp = null
  }
}
