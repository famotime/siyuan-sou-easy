import type { PluginSettings } from '@/settings'

export type HotkeySettingKey = 'panelHotkey' | 'replacePanelHotkey'

type BooleanSettingKey =
  | 'debugLog'
  | 'defaultReplaceVisible'
  | 'includeCodeBlock'
  | 'minimapVisible'
  | 'preloadSelection'
  | 'preserveCase'
  | 'rememberPanelPosition'

interface SettingDefinition<TKey extends keyof PluginSettings> {
  descriptionKey: string
  settingKey: TKey
  titleKey: string
}

export const HOTKEY_SETTING_DEFINITIONS: ReadonlyArray<SettingDefinition<HotkeySettingKey>> = [
  {
    descriptionKey: 'settingPanelHotkeyDesc',
    settingKey: 'panelHotkey',
    titleKey: 'settingPanelHotkeyTitle',
  },
  {
    descriptionKey: 'settingReplaceHotkeyDesc',
    settingKey: 'replacePanelHotkey',
    titleKey: 'settingReplaceHotkeyTitle',
  },
]

export const BOOLEAN_SETTING_DEFINITIONS: ReadonlyArray<SettingDefinition<BooleanSettingKey>> = [
  {
    descriptionKey: 'settingDefaultReplaceVisibleDesc',
    settingKey: 'defaultReplaceVisible',
    titleKey: 'settingDefaultReplaceVisibleTitle',
  },
  {
    descriptionKey: 'settingRememberPositionDesc',
    settingKey: 'rememberPanelPosition',
    titleKey: 'settingRememberPositionTitle',
  },
  {
    descriptionKey: 'settingMinimapDesc',
    settingKey: 'minimapVisible',
    titleKey: 'settingMinimapTitle',
  },
  {
    descriptionKey: 'settingPreloadSelectionDesc',
    settingKey: 'preloadSelection',
    titleKey: 'settingPreloadSelectionTitle',
  },
  {
    descriptionKey: 'settingIncludeCodeBlockDesc',
    settingKey: 'includeCodeBlock',
    titleKey: 'settingIncludeCodeBlockTitle',
  },
  {
    descriptionKey: 'settingDebugLogDesc',
    settingKey: 'debugLog',
    titleKey: 'settingDebugLogTitle',
  },
  {
    descriptionKey: 'settingPreserveCaseDesc',
    settingKey: 'preserveCase',
    titleKey: 'settingPreserveCaseTitle',
  },
]
