import type { Plugin } from 'siyuan'
import type {
  PanelPosition,
  PersistedUiState,
} from './state'

export const UI_STATE_STORAGE = 'ui-state.json'

let pluginInstance: Plugin | null = null
let persistTimer = 0
// 防抖窗口内挂起的最后一次位置/宽度变更，卸载时立即刷写，避免丢失
let pendingUiState: { position: PanelPosition | null, width?: number | null } | null = null

export function bindUiStatePlugin(plugin: Plugin) {
  pluginInstance = plugin
}

export function unbindUiStatePlugin() {
  window.clearTimeout(persistTimer)
  // 卸载前立即发起挂起变更的写入：saveData 是内核级请求，
  // 发起后即使实例引用随后置空，写入仍会完成，最后一次拖动不会丢失
  if (pendingUiState && pluginInstance) {
    const { position, width } = pendingUiState
    pendingUiState = null
    void persistUiState(position, width)
  }
  pluginInstance = null
}

export async function loadStoredUiState(): Promise<PersistedUiState | undefined> {
  if (!pluginInstance) {
    return undefined
  }

  try {
    const data = await pluginInstance.loadData(UI_STATE_STORAGE) as PersistedUiState | null
    if (!data) {
      return undefined
    }

    return {
      panelPosition: normalizePanelPosition(data.panelPosition),
      panelWidth: normalizePanelWidth(data.panelWidth),
    }
  } catch {
    return undefined
  }
}

export function schedulePersistUiState(
  position: PanelPosition | null,
  width?: number | null,
  delay = 180,
) {
  if (!pluginInstance) {
    return
  }

  pendingUiState = { position, width }
  window.clearTimeout(persistTimer)
  persistTimer = window.setTimeout(() => {
    pendingUiState = null
    void persistUiState(position, width)
  }, delay)
}

export async function persistUiState(
  position: PanelPosition | null,
  width?: number | null,
) {
  if (!pluginInstance) {
    return
  }

  const payload: PersistedUiState = {
    panelPosition: normalizePanelPosition(position),
  }
  const normalizedWidth = normalizePanelWidth(width)
  if (normalizedWidth !== null) {
    payload.panelWidth = normalizedWidth
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

export function normalizePanelWidth(width: number | null | undefined) {
  if (typeof width !== 'number' || !Number.isFinite(width)) {
    return null
  }

  const rounded = Math.round(width)
  return rounded > 0 ? rounded : null
}

