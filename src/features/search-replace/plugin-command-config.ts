import type { IProtyle } from 'siyuan'
import PluginInfoString from '@/../plugin.json'
import type { HotkeySettingKey } from './settings-panel'
import {
  DEFAULT_SETTINGS,
  type PluginSettings,
} from '@/settings'
import {
  normalizeHotkey,
  type HotkeySource,
} from '@/hotkeys'

type CommandCallback = () => void
type EditorCommandCallback = (protyle: IProtyle) => void
type PanelCommandLangKey = 'togglePanel' | 'toggleReplacePanel'

export interface CommandHotkeyShape {
  customHotkey?: string
  hotkey?: string
  langKey?: string
}

interface PanelCommandDefinition {
  defaultHotkey: keyof PluginSettings
  editorCallback: keyof PanelCommandCallbacks
  langKey: PanelCommandLangKey
  openCallback: keyof PanelCommandCallbacks
  settingKey: HotkeySettingKey
}

interface PanelCommandCallbacks {
  openFindPanel: CommandCallback
  openFindPanelFromEditor: EditorCommandCallback
  openReplacePanel: CommandCallback
  openReplacePanelFromEditor: EditorCommandCallback
}

const PANEL_COMMAND_DEFINITIONS: PanelCommandDefinition[] = [
  {
    defaultHotkey: 'panelHotkey',
    editorCallback: 'openFindPanelFromEditor',
    langKey: 'togglePanel',
    openCallback: 'openFindPanel',
    settingKey: 'panelHotkey',
  },
  {
    defaultHotkey: 'replacePanelHotkey',
    editorCallback: 'openReplacePanelFromEditor',
    langKey: 'toggleReplacePanel',
    openCallback: 'openReplacePanel',
    settingKey: 'replacePanelHotkey',
  },
]

const { name: pluginName = 'siyuan-sou-easy' } = PluginInfoString as { name?: string }

export function createPanelCommands({
  callbacks,
  settings,
  toRegisteredHotkey,
}: {
  callbacks: PanelCommandCallbacks
  settings: PluginSettings
  toRegisteredHotkey: (hotkey: string) => string
}) {
  return PANEL_COMMAND_DEFINITIONS.map((definition) => {
    const callback = callbacks[definition.openCallback]

    return {
      callback,
      customHotkey: toRegisteredHotkey(settings[definition.settingKey]),
      dockCallback: callback,
      editorCallback: callbacks[definition.editorCallback],
      fileTreeCallback: callback,
      hotkey: toRegisteredHotkey(DEFAULT_SETTINGS[definition.defaultHotkey]),
      langKey: definition.langKey,
    }
  })
}

export function syncPanelCommandHotkeys({
  commands,
  settings,
  toRegisteredHotkey,
}: {
  commands: any[]
  settings: PluginSettings
  toRegisteredHotkey: (hotkey: string) => string
}) {
  PANEL_COMMAND_DEFINITIONS.forEach((definition) => {
    const command = commands.find(candidate => candidate.langKey === definition.langKey)
    if (!command) {
      return
    }

    command.hotkey = toRegisteredHotkey(DEFAULT_SETTINGS[definition.defaultHotkey])
    command.customHotkey = toRegisteredHotkey(settings[definition.settingKey])
  })
}

export function getPanelCommandLangKey(settingKey: HotkeySettingKey): PanelCommandLangKey {
  return getPanelCommandDefinition(settingKey).langKey
}

export function isPanelCommandKeymapSource(source: HotkeySource, settingKey: HotkeySettingKey) {
  return source.label.split('.').at(-1) === getPanelCommandLangKey(settingKey)
}

export function updatePanelCommandKeymap({
  hotkey,
  keymap,
  settingKey,
}: {
  hotkey: string
  keymap: unknown
  settingKey: HotkeySettingKey
}) {
  if (!isRecord(keymap)) {
    return null
  }

  const nextKeymap = cloneKeymap(keymap)
  const pluginKeymap = getOrCreateRecord(nextKeymap, 'plugin')
  const pluginCommandKeymap = getOrCreateRecord(pluginKeymap, pluginName)
  const commandLangKey = getPanelCommandLangKey(settingKey)
  const existingLeaf = pluginCommandKeymap[commandLangKey]
  const nextLeaf = isRecord(existingLeaf) ? { ...existingLeaf } : {}
  const definition = getPanelCommandDefinition(settingKey)

  nextLeaf.custom = hotkey
  if (typeof nextLeaf.default !== 'string' || !nextLeaf.default.trim()) {
    nextLeaf.default = DEFAULT_SETTINGS[definition.defaultHotkey]
  }

  pluginCommandKeymap[commandLangKey] = nextLeaf
  return nextKeymap
}

export function resolveHotkeySettingsFromRuntime({
  commands,
  keymapSources,
  settings,
}: {
  commands: CommandHotkeyShape[]
  keymapSources: HotkeySource[]
  settings: PluginSettings
}) {
  return {
    ...settings,
    panelHotkey: resolvePanelCommandHotkey({
      commands,
      keymapSources,
      settingKey: 'panelHotkey',
      settings,
    }),
    replacePanelHotkey: resolvePanelCommandHotkey({
      commands,
      keymapSources,
      settingKey: 'replacePanelHotkey',
      settings,
    }),
  }
}

function resolvePanelCommandHotkey({
  commands,
  keymapSources,
  settingKey,
  settings,
}: {
  commands: CommandHotkeyShape[]
  keymapSources: HotkeySource[]
  settingKey: HotkeySettingKey
  settings: PluginSettings
}) {
  const command = commands.find(candidate => candidate.langKey === getPanelCommandLangKey(settingKey))
  const normalizedCommandHotkey = normalizeHotkey(command?.customHotkey)
  if (normalizedCommandHotkey) {
    return normalizedCommandHotkey
  }

  const keymapHotkey = keymapSources.find(source => isPanelCommandKeymapSource(source, settingKey))?.hotkey
  const normalizedKeymapHotkey = normalizeHotkey(keymapHotkey)
  if (normalizedKeymapHotkey) {
    return normalizedKeymapHotkey
  }

  return settings[settingKey]
}

function getPanelCommandDefinition(settingKey: HotkeySettingKey) {
  return PANEL_COMMAND_DEFINITIONS.find(definition => definition.settingKey === settingKey)!
}

function cloneKeymap(keymap: Record<string, unknown>) {
  if (typeof structuredClone === 'function') {
    return structuredClone(keymap) as Record<string, unknown>
  }

  return JSON.parse(JSON.stringify(keymap)) as Record<string, unknown>
}

function getOrCreateRecord(target: Record<string, unknown>, key: string) {
  const value = target[key]
  if (isRecord(value)) {
    return value
  }

  const nextValue: Record<string, unknown> = {}
  target[key] = nextValue
  return nextValue
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
