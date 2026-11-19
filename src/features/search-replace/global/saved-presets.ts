import { getPluginInstance } from '@/plugin-instance'
import type { GlobalSearchFilters, GlobalSearchStateModel } from './types'

export interface SavedSearchPreset {
  id: string
  name: string
  query: string
  replacement?: string
  options: GlobalSearchStateModel['options']
  filters: GlobalSearchFilters
  createdAt: number
}

export const PRESETS_STORAGE = 'saved_searches.json'

let presetsCache: SavedSearchPreset[] = []
// 缓存持有尚未落盘（保存中或落盘失败）的本地变更时为 true：
// 此时禁止用磁盘旧态整体覆盖缓存，否则保存期间重开菜单会把刚保存的预设抹掉
let presetsDirty = false

export async function loadSavedPresets(): Promise<SavedSearchPreset[]> {
  const plugin = getPluginInstance()
  if (!plugin) return presetsCache
  if (presetsDirty) {
    return presetsCache
  }
  try {
    const data = await plugin.loadData(PRESETS_STORAGE)
    if (Array.isArray(data)) {
      presetsCache = data
    }
  } catch {
  }
  return presetsCache
}

export async function persistSavedPresets(): Promise<boolean> {
  const plugin = getPluginInstance()
  if (!plugin) return false
  try {
    await plugin.saveData(PRESETS_STORAGE, presetsCache)
    presetsDirty = false
    return true
  } catch (err) {
    presetsDirty = true
    console.error('persistSavedPresets failed:', err)
    return false
  }
}

export async function savePreset(
  name: string,
  state: {
    query: string
    replacement?: string
    options: GlobalSearchStateModel['options']
    filters: GlobalSearchFilters
  },
): Promise<SavedSearchPreset> {
  const preset: SavedSearchPreset = {
    id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || '未命名预设',
    query: state.query,
    replacement: state.replacement,
    options: { ...state.options },
    filters: { ...state.filters },
    createdAt: Date.now(),
  }

  presetsCache.unshift(preset)
  presetsDirty = true
  await persistSavedPresets()
  return preset
}

export async function deletePreset(id: string): Promise<boolean> {
  const idx = presetsCache.findIndex(p => p.id === id)
  if (idx >= 0) {
    presetsCache.splice(idx, 1)
    presetsDirty = true
    await persistSavedPresets()
    return true
  }
  return false
}

export function getSavedPresets(): SavedSearchPreset[] {
  return presetsCache
}

export function clearPresetsForTesting(): void {
  presetsCache = []
  presetsDirty = false
}
