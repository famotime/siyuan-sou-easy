import type { Plugin } from 'siyuan'
import type { SearchOptions } from '@/features/search-replace/types'

export interface PluginSettings {
  panelHotkey: string
  replacePanelHotkey: string
  defaultReplaceVisible: boolean
  rememberPanelPosition: boolean
  preloadSelection: boolean
  includeCodeBlock: boolean
  debugLog: boolean
  preserveCase: boolean
}

export const DEFAULT_SETTINGS: PluginSettings = {
  panelHotkey: '⌘⇧F',
  replacePanelHotkey: '⌘⇧H',
  defaultReplaceVisible: false,
  rememberPanelPosition: true,
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
  }
}

function normalizeHotkey(value: string | undefined, fallback: string) {
  if (typeof value !== 'string') {
    return fallback
  }

  const trimmed = value.trim()
  return trimmed || fallback
}
