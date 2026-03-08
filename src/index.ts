import {
  Plugin,
  getFrontend,
  showMessage,
} from 'siyuan'
import '@/index.scss'
import PluginInfoString from '@/../plugin.json'
import {
  normalizeHotkey,
} from '@/hotkeys'
import {
  SEARCH_REPLACE_TOP_BAR_ICON,
  SEARCH_REPLACE_TOP_BAR_ICON_ID,
} from '@/icons'
import {
  applyPluginSettings,
  onEditorContextChanged,
  openPanel,
} from '@/features/search-replace/store'
import { createEditorContextFromProtyleLike } from '@/features/search-replace/editor'
import {
  destroy,
  init,
} from '@/main'
import {
  DEFAULT_SETTINGS,
  type PluginSettings,
  loadSettings,
  normalizeSettings,
  saveSettings,
} from '@/settings'
import {
  bindEditorEvents,
  registerPluginCommands,
  syncPluginCommandHotkeys,
  unbindEditorEvents,
} from '@/plugin-commands'
import {
  createCheckboxElement,
  createHotkeyInputElement,
  findHotkeySettingConflict,
  openPluginSettings,
  type HotkeySettingKey,
} from '@/plugin-settings'

let pluginInfo = {
  version: '',
}

try {
  pluginInfo = PluginInfoString
} catch (error) {
  console.warn('Plugin info parse error', error)
}

const { version } = pluginInfo

export default class FriendlySearchReplacePlugin extends Plugin {
  public isMobile: boolean
  public isBrowser: boolean
  public isLocal: boolean
  public isElectron: boolean
  public isInWindow: boolean
  public platform: SyFrontendTypes
  public readonly version = version
  private settingsData: PluginSettings = { ...DEFAULT_SETTINGS }

  private readonly handleEditorEvent = (event?: CustomEvent<{
    protyle?: {
      block?: {
        rootID?: string
      }
      element?: HTMLElement
    }
  }>) => {
    onEditorContextChanged(createEditorContextFromProtyleLike(event?.detail?.protyle))
  }

  async onload() {
    const frontEnd = getFrontend()
    this.platform = frontEnd as SyFrontendTypes
    this.isMobile = frontEnd === 'mobile' || frontEnd === 'browser-mobile'
    this.isBrowser = frontEnd.includes('browser')
    this.isLocal = location.href.includes('127.0.0.1') || location.href.includes('localhost')
    this.isInWindow = location.href.includes('window.html')

    try {
      require('@electron/remote').require('@electron/remote/main')
      this.isElectron = true
    } catch {
      this.isElectron = false
    }

    this.settingsData = await loadSettings(this)
    applyPluginSettings(this.settingsData)

    await init(this)

    this.addIcons(SEARCH_REPLACE_TOP_BAR_ICON)

    this.addTopBar({
      icon: SEARCH_REPLACE_TOP_BAR_ICON_ID,
      title: this.i18n.addTopBarIcon,
      callback: () => {
        openPanel()
      },
    })

    registerPluginCommands(this, this.settingsData, openPanel)
    bindEditorEvents(this.eventBus, this.handleEditorEvent)
  }

  onunload() {
    unbindEditorEvents(this.eventBus, this.handleEditorEvent)
    destroy()
  }

  openSetting() {
    openPluginSettings({
      name: this.name,
      i18n: this.i18n,
      getSettings: () => this.settingsData,
      createHotkeyInput: (value, onChange) => this.createHotkeyInput(value, onChange),
      createCheckbox: (checked, onChange) => this.createCheckbox(checked, onChange),
      updateHotkeySetting: (settingKey, value) => this.updateHotkeySetting(settingKey, value),
      applySettings: nextSettings => this.applySettings(nextSettings),
    })
  }

  private async applySettings(nextSettings: PluginSettings, showSavedMessage = true) {
    const normalized = normalizeSettings(nextSettings)
    this.settingsData = normalized
    applyPluginSettings(normalized)
    this.syncCommandHotkeys()
    await saveSettings(this, normalized)
    if (showSavedMessage) {
      showMessage(this.i18n.settingSaved, 2500, 'info')
    }
  }

  private syncCommandHotkeys() {
    syncPluginCommandHotkeys(this.commands, this.settingsData)
  }

  private async updateHotkeySetting(settingKey: HotkeySettingKey, value: string) {
    const normalizedHotkey = normalizeHotkey(value)
    if (!normalizedHotkey) {
      return false
    }

    const conflict = this.findHotkeySettingConflict(settingKey, normalizedHotkey)
    if (conflict) {
      showMessage(`\u5feb\u6377\u952e ${normalizedHotkey} \u4e0e\u5df2\u6709\u5feb\u6377\u952e\u51b2\u7a81\uff1a${conflict.label}`, 4000, 'warning')
      return false
    }

    await this.applySettings({
      ...this.settingsData,
      [settingKey]: normalizedHotkey,
    })
    return true
  }

  private createHotkeyInput(value: string, onChange: (value: string) => Promise<boolean>) {
    return createHotkeyInputElement(value, onChange)
  }

  private findHotkeySettingConflict(settingKey: HotkeySettingKey, hotkey: string) {
    return findHotkeySettingConflict(
      settingKey,
      hotkey,
      this.settingsData,
      this.commands,
      (window as any).siyuan?.config?.keymap,
    )
  }

  private createCheckbox(checked: boolean, onChange: (checked: boolean) => Promise<void>) {
    return createCheckboxElement(checked, onChange)
  }
}
