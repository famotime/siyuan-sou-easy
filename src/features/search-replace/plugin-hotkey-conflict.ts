import type { HotkeySource } from '@/hotkeys'
import type { HotkeySettingKey } from './settings-panel'
import {
  getPanelCommandLangKey,
  isPanelCommandKeymapSource,
  type CommandHotkeyShape,
} from './plugin-command-config'

interface SettingsHotkeyShape {
  panelHotkey: string
  replacePanelHotkey: string
}

export function getIgnoredCommandLangKeys(settingKey: HotkeySettingKey) {
  return [getPanelCommandLangKey(settingKey)]
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
  const ignoredLangKey = getPanelCommandLangKey(settingKey)
  const commandSources = commands
    .filter(command => command.langKey !== ignoredLangKey)
    .map(command => ({
      hotkey: command.customHotkey || command.hotkey,
      label: command.langKey || 'plugin.command',
    }))
    .filter(command => Boolean(command.hotkey)) as HotkeySource[]

  return [
    ...commandSources,
    ...keymapSources.filter(source => !isPanelCommandKeymapSource(source, settingKey)),
  ]
}
