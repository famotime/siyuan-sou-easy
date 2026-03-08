import { Setting } from 'siyuan'
import {
  collectKeymapHotkeys,
  findHotkeyConflict,
  formatHotkeyFromEvent,
  normalizeHotkey,
  type HotkeySource,
} from '@/hotkeys'
import type { PluginSettings } from '@/settings'
import {
  PANEL_COMMAND_LANG_KEY,
  REPLACE_PANEL_COMMAND_LANG_KEY,
} from '@/plugin-commands'

export type HotkeySettingKey = 'panelHotkey' | 'replacePanelHotkey'

type BooleanSettingKey =
  | 'defaultReplaceVisible'
  | 'rememberPanelPosition'
  | 'preloadSelection'
  | 'includeCodeBlock'
  | 'debugLog'
  | 'preserveCase'

type SettingsI18n = Record<string, string>

type SettingItemLike = {
  createActionElement: () => HTMLElement
  description: string
  title: string
}

interface OpenPluginSettingsOptions {
  applySettings: (nextSettings: PluginSettings) => Promise<void>
  createCheckbox: (checked: boolean, onChange: (checked: boolean) => Promise<void>) => HTMLInputElement
  createHotkeyInput: (value: string, onChange: (value: string) => Promise<boolean>) => HTMLInputElement
  getSettings: () => PluginSettings
  i18n: SettingsI18n
  name: string
  updateHotkeySetting: (settingKey: HotkeySettingKey, value: string) => Promise<boolean>
}

const BOOLEAN_SETTING_DESCRIPTORS: Array<{
  descriptionKey: string
  settingKey: BooleanSettingKey
  titleKey: string
}> = [
  {
    settingKey: 'defaultReplaceVisible',
    titleKey: 'settingDefaultReplaceVisibleTitle',
    descriptionKey: 'settingDefaultReplaceVisibleDesc',
  },
  {
    settingKey: 'rememberPanelPosition',
    titleKey: 'settingRememberPositionTitle',
    descriptionKey: 'settingRememberPositionDesc',
  },
  {
    settingKey: 'preloadSelection',
    titleKey: 'settingPreloadSelectionTitle',
    descriptionKey: 'settingPreloadSelectionDesc',
  },
  {
    settingKey: 'includeCodeBlock',
    titleKey: 'settingIncludeCodeBlockTitle',
    descriptionKey: 'settingIncludeCodeBlockDesc',
  },
  {
    settingKey: 'debugLog',
    titleKey: 'settingDebugLogTitle',
    descriptionKey: 'settingDebugLogDesc',
  },
  {
    settingKey: 'preserveCase',
    titleKey: 'settingPreserveCaseTitle',
    descriptionKey: 'settingPreserveCaseDesc',
  },
]

export function openPluginSettings(options: OpenPluginSettingsOptions) {
  const setting = new Setting({
    width: '620px',
  })

  createSettingItems(options).forEach((item) => {
    setting.addItem(item)
  })

  setting.open(options.name)
}

export function createHotkeyInputElement(value: string, onChange: (value: string) => Promise<boolean>) {
  const input = document.createElement('input')
  input.className = 'b3-text-field fn__size200'
  input.autocomplete = 'off'
  input.placeholder = '点击后按下快捷键'
  input.readOnly = true
  input.spellcheck = false

  let currentValue = normalizeHotkey(value) || value
  input.value = currentValue

  input.addEventListener('click', () => {
    input.focus()
    input.select()
  })
  input.addEventListener('focus', () => {
    input.select()
  })
  input.addEventListener('keydown', async (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      input.value = currentValue
      input.blur()
      return
    }

    const hotkey = formatHotkeyFromEvent(event)
    if (!hotkey) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    input.value = hotkey
    const accepted = await onChange(hotkey)
    if (accepted) {
      currentValue = hotkey
    } else {
      input.value = currentValue
    }

    input.blur()
  })

  return input
}

export function createCheckboxElement(checked: boolean, onChange: (checked: boolean) => Promise<void>) {
  const input = document.createElement('input')
  input.className = 'b3-switch fn__flex-center'
  input.type = 'checkbox'
  input.checked = checked
  input.addEventListener('change', async () => {
    await onChange(input.checked)
  })
  return input
}

export function findHotkeySettingConflict(
  settingKey: HotkeySettingKey,
  hotkey: string,
  settings: PluginSettings,
  commands: Array<{ customHotkey?: string, hotkey?: string, langKey?: string }>,
  keymap: unknown,
) {
  const ignoredHotkeys = [settings[settingKey]]
  return findHotkeyConflict(hotkey, getKnownHotkeySources(settingKey, commands, keymap), ignoredHotkeys)
}

export function getKnownHotkeySources(
  settingKey: HotkeySettingKey,
  commands: Array<{ customHotkey?: string, hotkey?: string, langKey?: string }>,
  keymap: unknown,
): HotkeySource[] {
  const ignoredLangKey = settingKey === 'panelHotkey'
    ? PANEL_COMMAND_LANG_KEY
    : REPLACE_PANEL_COMMAND_LANG_KEY

  const commandSources = commands
    .filter(command => command.langKey !== ignoredLangKey)
    .map(command => ({
      hotkey: command.customHotkey || command.hotkey || '',
      label: command.langKey || 'plugin.command',
    }))
    .filter(command => Boolean(command.hotkey)) as HotkeySource[]

  const keymapSources = collectKeymapHotkeys(keymap)
  return [...commandSources, ...keymapSources]
}

function createSettingItems(options: OpenPluginSettingsOptions) {
  const hotkeyItems: SettingItemLike[] = [
    {
      title: options.i18n.settingPanelHotkeyTitle,
      description: options.i18n.settingPanelHotkeyDesc,
      createActionElement: () => options.createHotkeyInput(options.getSettings().panelHotkey, async (value) => {
        return await options.updateHotkeySetting('panelHotkey', value)
      }),
    },
    {
      title: options.i18n.settingReplaceHotkeyTitle,
      description: options.i18n.settingReplaceHotkeyDesc,
      createActionElement: () => options.createHotkeyInput(options.getSettings().replacePanelHotkey, async (value) => {
        return await options.updateHotkeySetting('replacePanelHotkey', value)
      }),
    },
  ]

  const booleanItems: SettingItemLike[] = BOOLEAN_SETTING_DESCRIPTORS.map((descriptor) => ({
    title: options.i18n[descriptor.titleKey],
    description: options.i18n[descriptor.descriptionKey],
    createActionElement: () => options.createCheckbox(options.getSettings()[descriptor.settingKey], async (checked) => {
      await options.applySettings({
        ...options.getSettings(),
        [descriptor.settingKey]: checked,
      })
    }),
  }))

  return [...hotkeyItems, ...booleanItems]
}
