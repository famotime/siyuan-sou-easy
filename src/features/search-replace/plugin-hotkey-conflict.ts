import type { HotkeySource } from '@/hotkeys'
import type { HotkeySettingKey } from './settings-panel'

interface CommandHotkeyShape {
  customHotkey?: string
  hotkey?: string
  langKey?: string
}

interface SettingsHotkeyShape {
  panelHotkey: string
  replacePanelHotkey: string
}

export function getIgnoredCommandLangKeys(settingKey: HotkeySettingKey) {
  return settingKey === 'panelHotkey'
    ? ['togglePanel']
    : ['toggleReplacePanel']
}

export function buildIgnoredHotkeys({
  commands,
  settingKey,
  settingsData,
}: {
  commands: CommandHotkeyShape[]
  settingKey: HotkeySettingKey
  settingsData: SettingsHotkeyShape
}) {
  const ignoredLangKeys = getIgnoredCommandLangKeys(settingKey)
  return [
    settingsData[settingKey],
    ...commands
      .filter(cmd => ignoredLangKeys.includes(cmd.langKey || ''))
      .map(cmd => cmd.customHotkey || cmd.hotkey)
      .filter(Boolean) as string[],
  ]
}

export function buildKnownHotkeySources({
  commands,
  keymapSources,
  settingKey,
}: {
  commands: CommandHotkeyShape[]
  keymapSources: HotkeySource[]
  settingKey: HotkeySettingKey
}) {
  const ignoredLangKey = settingKey === 'panelHotkey' ? 'togglePanel' : 'toggleReplacePanel'
  const commandSources = commands
    .filter(command => command.langKey !== ignoredLangKey)
    .map(command => ({
      hotkey: command.customHotkey || command.hotkey,
      label: command.langKey || 'plugin.command',
    }))
    .filter(command => Boolean(command.hotkey)) as HotkeySource[]

  return [...commandSources, ...keymapSources]
}
