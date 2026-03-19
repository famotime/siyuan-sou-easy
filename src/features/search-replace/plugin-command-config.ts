import type { HotkeySettingKey } from './settings-panel'
import {
  DEFAULT_SETTINGS,
  type PluginSettings,
} from '@/settings'

type CommandCallback = () => void
type EditorCommandCallback = (protyle: {
  block?: {
    rootID?: string
  }
  element?: HTMLElement
}) => void

interface PanelCommandDefinition {
  defaultHotkey: keyof PluginSettings
  editorCallback: keyof PanelCommandCallbacks
  langKey: 'togglePanel' | 'toggleReplacePanel'
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
