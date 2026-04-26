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
  optimizeLargeCodeBlocks: boolean
  largeCodeBlockLineThreshold: number
  searchAttributeView: boolean
  searchHighlightColor: string
  debugLog: boolean
  preserveCase: boolean
}

export const DEFAULT_SEARCH_HIGHLIGHT_COLOR = '#ffc400'

export const DEFAULT_SETTINGS: PluginSettings = {
  panelHotkey: 'Ctrl+F11',
  replacePanelHotkey: 'Ctrl+F12',
  defaultReplaceVisible: false,
  rememberPanelPosition: true,
  minimapVisible: false,
  preloadSelection: true,
  includeCodeBlock: false,
  optimizeLargeCodeBlocks: true,
  largeCodeBlockLineThreshold: 1000,
  searchAttributeView: false,
  searchHighlightColor: DEFAULT_SEARCH_HIGHLIGHT_COLOR,
  debugLog: false,
  preserveCase: false,
}

export const SETTINGS_STORAGE = 'settings.json'

export function isSupportedSearchHighlightColor(value: string) {
  const normalized = value.trim()
  if (!normalized) {
    return false
  }

  if (/^#(?:[\da-fA-F]{3}|[\da-fA-F]{6})$/.test(normalized)) {
    return true
  }

  return canResolveCssColor(normalized)
}

export async function loadSettings(plugin: Plugin): Promise<PluginSettings> {
  try {
    const data = await plugin.loadData(SETTINGS_STORAGE) as Partial<PluginSettings> | null
    return normalizeSettings(data)
  } catch {
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
    optimizeLargeCodeBlocks: typeof settings?.optimizeLargeCodeBlocks === 'boolean'
      ? settings.optimizeLargeCodeBlocks
      : DEFAULT_SETTINGS.optimizeLargeCodeBlocks,
    largeCodeBlockLineThreshold: normalizeLargeCodeBlockLineThreshold(settings?.largeCodeBlockLineThreshold),
    searchAttributeView: typeof settings?.searchAttributeView === 'boolean'
      ? settings.searchAttributeView
      : DEFAULT_SETTINGS.searchAttributeView,
    searchHighlightColor: normalizeSearchHighlightColor(settings?.searchHighlightColor),
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
    searchAttributeView: settings.searchAttributeView,
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

function normalizeLargeCodeBlockLineThreshold(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return DEFAULT_SETTINGS.largeCodeBlockLineThreshold
  }

  const normalized = Math.floor(value)
  return normalized > 0 ? normalized : DEFAULT_SETTINGS.largeCodeBlockLineThreshold
}

function normalizeSearchHighlightColor(value: string | undefined) {
  if (typeof value !== 'string') {
    return DEFAULT_SETTINGS.searchHighlightColor
  }

  const normalized = value.trim()
  if (!isSupportedSearchHighlightColor(normalized)) {
    return DEFAULT_SETTINGS.searchHighlightColor
  }

  if (/^#(?:[\da-fA-F]{3}|[\da-fA-F]{6})$/.test(normalized)) {
    return normalized.toLowerCase()
  }

  return normalized
}

function canResolveCssColor(value: string) {
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    return CSS.supports('color', value)
  }

  if (typeof document === 'undefined') {
    return false
  }

  const sample = document.createElement('span')
  sample.style.color = ''
  sample.style.color = value
  return sample.style.color !== ''
}
