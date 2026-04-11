import type { Plugin } from 'siyuan'
import type { PluginSettings } from '@/settings'
import { DEFAULT_SETTINGS } from '@/settings'

export const PANEL_COMMAND_LANG_KEY = 'togglePanel'
export const REPLACE_PANEL_COMMAND_LANG_KEY = 'toggleReplacePanel'

const EDITOR_EVENT_NAMES = [
  'switch-protyle',
  'click-editorcontent',
  'loaded-protyle-dynamic',
  'loaded-protyle-static',
  'destroy-protyle',
] as const

type PluginCommandLike = {
  customHotkey?: string
  hotkey?: string
  langKey?: string
}

type PluginEventBusLike = {
  off: (eventName: string, handler: (...args: any[]) => void) => void
  on: (eventName: string, handler: (...args: any[]) => void) => void
}

export function registerPluginCommands(plugin: Plugin, settings: PluginSettings, openPanel: typeof import('@/features/search-replace/store').openPanel) {
  plugin.addCommand({
    langKey: PANEL_COMMAND_LANG_KEY,
    hotkey: DEFAULT_SETTINGS.panelHotkey,
    customHotkey: settings.panelHotkey,
    callback: () => {
      openPanel(true)
    },
  })

  plugin.addCommand({
    langKey: REPLACE_PANEL_COMMAND_LANG_KEY,
    hotkey: DEFAULT_SETTINGS.replacePanelHotkey,
    customHotkey: settings.replacePanelHotkey,
    callback: () => {
      openPanel(true, true)
    },
  })
}

export function syncPluginCommandHotkeys(commands: PluginCommandLike[], settings: PluginSettings) {
  const panelCommand = commands.find(command => command.langKey === PANEL_COMMAND_LANG_KEY)
  if (panelCommand) {
    panelCommand.hotkey = DEFAULT_SETTINGS.panelHotkey
    panelCommand.customHotkey = settings.panelHotkey
  }

  const replaceCommand = commands.find(command => command.langKey === REPLACE_PANEL_COMMAND_LANG_KEY)
  if (replaceCommand) {
    replaceCommand.hotkey = DEFAULT_SETTINGS.replacePanelHotkey
    replaceCommand.customHotkey = settings.replacePanelHotkey
  }
}

export function bindEditorEvents(eventBus: PluginEventBusLike, handler: (...args: any[]) => void) {
  EDITOR_EVENT_NAMES.forEach((eventName) => {
    eventBus.on(eventName, handler)
  })
}

export function unbindEditorEvents(eventBus: PluginEventBusLike, handler: (...args: any[]) => void) {
  EDITOR_EVENT_NAMES.forEach((eventName) => {
    eventBus.off(eventName, handler)
  })
}
