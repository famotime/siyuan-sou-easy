import type { IProtyle } from 'siyuan'
import type { HotkeySettingKey } from './settings-panel'
import type { HotkeySource } from '@/hotkeys'
import type { PluginSettings } from '@/settings'
import PluginInfoString from '@/../plugin.json'
import {

  normalizeHotkey,
} from '@/hotkeys'
import {
  DEFAULT_SETTINGS,

} from '@/settings'

type CommandCallback = () => void
type EditorCommandCallback = (protyle: IProtyle) => void
type PanelCommandLangKey = 'togglePanel' | 'toggleReplacePanel'

export interface CommandHotkeyShape {
  customHotkey?: string
  hotkey?: string
  langKey?: string
}

interface PanelCommandDefinition {
  defaultHotkey: 'panelHotkey' | 'replacePanelHotkey'
  editorCallback: 'openFindPanelFromEditor' | 'openReplacePanelFromEditor'
  langKey: PanelCommandLangKey
  openCallback: 'openFindPanel' | 'openReplacePanel'
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
    const openPanel = () => {
      callbacks[definition.openCallback]()
    }

    return {
      callback: openPanel,
      customHotkey: toRegisteredHotkey(settings[definition.settingKey]),
      dockCallback: openPanel,
      editorCallback: (protyle: IProtyle) => {
        callbacks[definition.editorCallback](protyle)
      },
      fileTreeCallback: openPanel,
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
    const command = commands.find((candidate) => candidate.langKey === definition.langKey)
    if (!command) {
      return
    }

    command.hotkey = toRegisteredHotkey(DEFAULT_SETTINGS[definition.defaultHotkey])
    command.customHotkey = toRegisteredHotkey(settings[definition.settingKey])
  })

  // openGlobalSearch 命令不属于面板命令定义，但设置中修改 globalSearchHotkey
  // 时必须同步其注册热键，否则旧热键仍可通过思源命令系统触发（幽灵热键）。
  // Dock config.hotkey 无法在运行期更新，需重载插件后生效。
  const globalSearchCommand = commands.find((candidate) => candidate.langKey === 'openGlobalSearch')
  if (globalSearchCommand) {
    globalSearchCommand.hotkey = toRegisteredHotkey(DEFAULT_SETTINGS.globalSearchHotkey || 'Ctrl+Shift+F')
    globalSearchCommand.customHotkey = toRegisteredHotkey(settings.globalSearchHotkey || '')
  }
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
    panelHotkey: resolveCommandHotkey({
      commands,
      defaultHotkey: DEFAULT_SETTINGS.panelHotkey,
      keymapSources,
      langKey: 'togglePanel',
      settingHotkey: settings.panelHotkey,
    }),
    replacePanelHotkey: resolveCommandHotkey({
      commands,
      defaultHotkey: DEFAULT_SETTINGS.replacePanelHotkey,
      keymapSources,
      langKey: 'toggleReplacePanel',
      settingHotkey: settings.replacePanelHotkey,
    }),
    globalSearchHotkey: resolveCommandHotkey({
      commands,
      defaultHotkey: DEFAULT_SETTINGS.globalSearchHotkey,
      keymapSources,
      langKey: 'openGlobalSearch',
      settingHotkey: settings.globalSearchHotkey,
    }),
  }
}

function resolveCommandHotkey({
  commands,
  defaultHotkey,
  keymapSources,
  langKey,
  settingHotkey,
}: {
  commands: CommandHotkeyShape[]
  defaultHotkey: string
  keymapSources: HotkeySource[]
  langKey: string
  settingHotkey: string
}) {
  const command = commands.find((candidate) => candidate.langKey === langKey)
  if (command && typeof command.customHotkey === 'string') {
    const trimmed = command.customHotkey.trim()
    if (!trimmed) {
      return ''
    }
    const normalized = normalizeHotkey(trimmed)
    if (normalized) {
      return normalized
    }
  }

  if (typeof window !== 'undefined') {
    const pluginKeymap = (window as any).siyuan?.config?.keymap?.plugin?.[pluginName]
    const keymapLeaf = pluginKeymap?.[langKey]
    if (keymapLeaf && typeof keymapLeaf.custom === 'string') {
      const trimmed = keymapLeaf.custom.trim()
      if (!trimmed) {
        return ''
      }
      const normalized = normalizeHotkey(trimmed)
      if (normalized) {
        return normalized
      }
    }
  }

  const keymapSource = keymapSources.find((source) => source.label.split('.').at(-1) === langKey)
  if (keymapSource && typeof keymapSource.hotkey === 'string') {
    const trimmed = keymapSource.hotkey.trim()
    if (!trimmed) {
      return ''
    }
    const normalized = normalizeHotkey(trimmed)
    if (normalized) {
      return normalized
    }
  }

  if (typeof settingHotkey === 'string') {
    const trimmed = settingHotkey.trim()
    if (!trimmed) {
      return ''
    }
    return normalizeHotkey(trimmed) || defaultHotkey
  }

  return defaultHotkey
}

function getPanelCommandDefinition(settingKey: HotkeySettingKey) {
  return PANEL_COMMAND_DEFINITIONS.find((definition) => definition.settingKey === settingKey)!
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
