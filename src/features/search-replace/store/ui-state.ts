import type { Plugin } from 'siyuan'
import type {
  PanelPosition,
  PersistedUiState,
} from './state'

export const UI_STATE_STORAGE = 'ui-state.json'

let pluginInstance: Plugin | null = null
let persistTimer = 0

export function bindUiStatePlugin(plugin: Plugin) {
  pluginInstance = plugin
}

export function unbindUiStatePlugin() {
  window.clearTimeout(persistTimer)
  pluginInstance = null
}

export async function loadStoredPanelPosition() {
  if (!pluginInstance) {
    return undefined
  }

  try {
    const data = await pluginInstance.loadData(UI_STATE_STORAGE) as PersistedUiState | null
    if (!data) {
      return undefined
    }

    return normalizePanelPosition(data.panelPosition)
  } catch {
    return undefined
  }
}

export function schedulePersistUiState(position: PanelPosition | null, delay = 180) {
  if (!pluginInstance) {
    return
  }

  window.clearTimeout(persistTimer)
  persistTimer = window.setTimeout(() => {
    void persistUiState(position)
  }, delay)
}

export async function persistUiState(position: PanelPosition | null) {
  if (!pluginInstance) {
    return
  }

  const payload: PersistedUiState = {
    panelPosition: normalizePanelPosition(position),
  }

  try {
    await pluginInstance.saveData(UI_STATE_STORAGE, payload)
  } catch {}
}

export function normalizePanelPosition(position: PanelPosition | null | undefined) {
  if (!position) {
    return null
  }

  if (!Number.isFinite(position.left) || !Number.isFinite(position.top)) {
    return null
  }

  return {
    left: position.left,
    top: position.top,
  }
}
