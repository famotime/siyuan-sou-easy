import type { Plugin } from 'siyuan'

export interface PluginSettings {
  panelHotkey: string
  replacePanelHotkey: string
  defaultReplaceVisible: boolean
  rememberPanelPosition: boolean
  preloadSelection: boolean
}

export const DEFAULT_SETTINGS: PluginSettings = {
  panelHotkey: '⌘⇧F',
  replacePanelHotkey: '⌘⇧H',
  defaultReplaceVisible: true,
  rememberPanelPosition: true,
  preloadSelection: true,
}

const SETTINGS_STORAGE = 'settings.json'

export async function loadSettings(plugin: Plugin): Promise<PluginSettings> {
  try {
    const data = await plugin.loadData(SETTINGS_STORAGE) as Partial<PluginSettings> | null
    return normalizeSettings(data)
  } catch (error) {
    console.warn('Failed to load plugin settings', error)
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveSettings(plugin: Plugin, settings: PluginSettings) {
  await plugin.saveData(SETTINGS_STORAGE, normalizeSettings(settings))
}

export function normalizeSettings(settings?: Partial<PluginSettings> | null): PluginSettings {
  return {
    panelHotkey: normalizeHotkey(settings?.panelHotkey, DEFAULT_SETTINGS.panelHotkey),
    replacePanelHotkey: normalizeHotkey(settings?.replacePanelHotkey, DEFAULT_SETTINGS.replacePanelHotkey),
    defaultReplaceVisible: typeof settings?.defaultReplaceVisible === 'boolean'
      ? settings.defaultReplaceVisible
      : DEFAULT_SETTINGS.defaultReplaceVisible,
    rememberPanelPosition: typeof settings?.rememberPanelPosition === 'boolean'
      ? settings.rememberPanelPosition
      : DEFAULT_SETTINGS.rememberPanelPosition,
    preloadSelection: typeof settings?.preloadSelection === 'boolean'
      ? settings.preloadSelection
      : DEFAULT_SETTINGS.preloadSelection,
  }
}

function normalizeHotkey(value: string | undefined, fallback: string) {
  if (typeof value !== 'string') {
    return fallback
  }

  const trimmed = value.trim()
  return trimmed || fallback
}
