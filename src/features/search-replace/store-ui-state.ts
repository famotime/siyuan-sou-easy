import type { Plugin } from 'siyuan'
import {
  UI_STATE_STORAGE,
  normalizePanelPosition,
  type PanelPosition,
  type PersistedUiState,
} from './store-state'

export async function loadPersistedUiState(plugin: Plugin | null) {
  if (!plugin) {
    return null
  }

  try {
    const data = await plugin.loadData(UI_STATE_STORAGE) as PersistedUiState | null
    if (!data) {
      return null
    }

    return {
      panelPosition: normalizePanelPosition(data.panelPosition),
    }
  } catch (error) {
    console.warn('Failed to load search-replace UI state', error)
    return null
  }
}

export async function savePersistedUiState(plugin: Plugin | null, panelPosition: PanelPosition | null) {
  if (!plugin) {
    return
  }

  const payload: PersistedUiState = {
    panelPosition: normalizePanelPosition(panelPosition),
  }

  try {
    await plugin.saveData(UI_STATE_STORAGE, payload)
  } catch (error) {
    console.warn('Failed to save search-replace UI state', error)
  }
}
