import type { Plugin } from 'siyuan'
import { normalizeHotkey as normalizeCommandHotkey } from '@/hotkeys'
import type { SearchOptions } from '@/features/search-replace/types'

export interface PluginSettings {
  panelHotkey: string
  replacePanelHotkey: string
  defaultReplaceVisible: boolean
  rememberPanelPosition: boolean
  minimapVisible: boolean
  preloadSelection: boolean
  includeCodeBlock: boolean
  debugLog: boolean
  preserveCase: boolean
}

export const DEFAULT_SETTINGS: PluginSettings = {
  panelHotkey: 'Ctrl+F11',
  replacePanelHotkey: 'Ctrl+F12',
  defaultReplaceVisible: false,
  rememberPanelPosition: true,
  minimapVisible: false,
  preloadSelection: true,
  includeCodeBlock: false,
  debugLog: false,
  preserveCase: false,
}

const SETTINGS_STORAGE = 'settings.json'

export async function loadSettings(plugin: Plugin): Promise<PluginSettings> {
  try {
    const data = await plugin.loadData(SETTINGS_STORAGE) as Partial<PluginSettings> | null
    return normalizeSettings(data)
  } catch (error) {
    console.warn('Failed to load plugin settings', error)
    return normalizeSettings()
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
    minimapVisible: typeof settings?.minimapVisible === 'boolean'
      ? settings.minimapVisible
      : DEFAULT_SETTINGS.minimapVisible,
    preloadSelection: typeof settings?.preloadSelection === 'boolean'
      ? settings.preloadSelection
      : DEFAULT_SETTINGS.preloadSelection,
    includeCodeBlock: typeof settings?.includeCodeBlock === 'boolean'
      ? settings.includeCodeBlock
      : DEFAULT_SETTINGS.includeCodeBlock,
    debugLog: typeof settings?.debugLog === 'boolean'
      ? settings.debugLog
      : DEFAULT_SETTINGS.debugLog,
    preserveCase: typeof settings?.preserveCase === 'boolean'
      ? settings.preserveCase
      : DEFAULT_SETTINGS.preserveCase,
  }
}

export function createSearchOptionsFromSettings(settings: PluginSettings): SearchOptions {
  return {
    matchCase: false,
    wholeWord: false,
    useRegex: false,
    includeCodeBlock: settings.includeCodeBlock,
    selectionOnly: false,
  }
}

function normalizeHotkey(value: string | undefined, fallback: string) {
  const normalizedFallback = normalizeCommandHotkey(fallback) || fallback
  if (typeof value !== 'string') {
    return normalizedFallback
  }

  const normalized = normalizeCommandHotkey(value.trim())
  return normalized || normalizedFallback
}
