import {
  Plugin,
  Setting,
  adaptHotkey,
  showMessage,
} from 'siyuan'
import type { IProtyle } from 'siyuan'
import '@/index.scss'
import PluginInfoString from '@/../plugin.json'
import {
  collectKeymapHotkeys,
  findHotkeyConflict,
  formatHotkeyFromEvent,
  normalizeHotkey,
  type HotkeySource,
} from '@/hotkeys'
import {
  SEARCH_REPLACE_TOP_BAR_ICON,
  SEARCH_REPLACE_TOP_BAR_ICON_ID,
} from '@/icons'
import {
  bindEditorContextEvents,
  unbindEditorContextEvents,
} from '@/features/search-replace/plugin-events'
import { detectPluginEnvironment } from '@/features/search-replace/plugin-environment'
import {
  HOTKEY_CAPTURE_INPUT_ATTRIBUTE,
  createCheckboxElement,
  createHotkeyInputElement,
  createNumberInputElement,
} from '@/features/search-replace/plugin-setting-elements'
import {
  buildIgnoredHotkeys,
  buildKnownHotkeySources,
} from '@/features/search-replace/plugin-hotkey-conflict'
import {
  isHotkeyCaptureTarget,
  openSearchReplacePanelFromCommand,
  openSearchReplacePanelFromKeyboardEvent,
} from '@/features/search-replace/plugin-panel-launch'
import {
  type HotkeySettingKey,
  type NumberSettingKey,
} from '@/features/search-replace/settings-panel'
import {
  createPanelCommands,
  resolveHotkeySettingsFromRuntime,
  syncPanelCommandHotkeys,
} from '@/features/search-replace/plugin-command-config'
import { registerSearchReplaceSettings } from '@/features/search-replace/plugin-settings-ui'
import {
  applyPluginSettings,
  onEditorContextChanged,
  openPanel,
} from '@/features/search-replace/store'
import { UI_STATE_STORAGE } from '@/features/search-replace/store/ui-state'
import { createEditorContextFromProtyleLike } from '@/features/search-replace/editor'
import {
  destroy,
  init,
} from '@/main'
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE,
  type PluginSettings,
  loadSettings,
  normalizeSettings,
  saveSettings,
} from '@/settings'

let pluginInfo = {
  version: '',
}

try {
  pluginInfo = PluginInfoString
} catch {
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
    protyle?: IProtyle
  }>) => {
    onEditorContextChanged(createEditorContextFromProtyleLike(event?.detail?.protyle))
  }

  private readonly openFindPanelCommand = () => {
    this.openPanelFromCommand(false)
  }

  private readonly openReplacePanelCommand = () => {
    this.openPanelFromCommand(true)
  }

  private readonly openFindPanelFromEditorCommand = (protyle: IProtyle) => {
    this.openPanelFromCommand(false, protyle)
  }

  private readonly openReplacePanelFromEditorCommand = (protyle: IProtyle) => {
    this.openPanelFromCommand(true, protyle)
  }

  private readonly handleDocumentKeydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) {
      return
    }

    const target = event.target instanceof Element ? event.target : null
    if (isHotkeyCaptureTarget(target, HOTKEY_CAPTURE_INPUT_ATTRIBUTE)) {
      return
    }

    const hotkey = formatHotkeyFromEvent(event)
    if (!hotkey) {
      return
    }

    const normalizedHotkey = normalizeHotkey(hotkey)
    if (!normalizedHotkey) {
      return
    }

    const runtimeHotkeySettings = this.getRuntimeHotkeySettings()

    if (normalizedHotkey === runtimeHotkeySettings.panelHotkey) {
      event.preventDefault()
      event.stopPropagation()
      openSearchReplacePanelFromKeyboardEvent(event, false)
      return
    }

    if (normalizedHotkey === runtimeHotkeySettings.replacePanelHotkey) {
      event.preventDefault()
      event.stopPropagation()
      openSearchReplacePanelFromKeyboardEvent(event, true)
    }
  }

  async onload() {
    const environment = detectPluginEnvironment()
    this.platform = environment.platform
    this.isMobile = environment.isMobile
    this.isBrowser = environment.isBrowser
    this.isLocal = environment.isLocal
    this.isInWindow = environment.isInWindow
    this.isElectron = environment.isElectron

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

    const panelCommands = createPanelCommands({
      callbacks: {
        openFindPanel: this.openFindPanelCommand,
        openFindPanelFromEditor: this.openFindPanelFromEditorCommand,
        openReplacePanel: this.openReplacePanelCommand,
        openReplacePanelFromEditor: this.openReplacePanelFromEditorCommand,
      },
      settings: this.settingsData,
      toRegisteredHotkey: this.toRegisteredHotkey.bind(this),
    })
    panelCommands.forEach(command => this.addCommand(command))

    bindEditorContextEvents(this.eventBus, this.handleEditorEvent)
    window.addEventListener('keydown', this.handleDocumentKeydown, true)
  }

  onunload() {
    unbindEditorContextEvents(this.eventBus, this.handleEditorEvent)
    window.removeEventListener('keydown', this.handleDocumentKeydown, true)
    destroy()
  }

  async uninstall() {
    await this.removeData(SETTINGS_STORAGE)
    await this.removeData(UI_STATE_STORAGE)
  }

  openSetting() {
    const setting = new Setting({
      width: '620px',
    })

    registerSearchReplaceSettings({
      createCheckbox: this.createCheckbox.bind(this),
      createHotkeyInput: this.createHotkeyInput.bind(this),
      createNumberInput: this.createNumberInput.bind(this),
      i18n: this.i18n,
      onBooleanChange: async (settingKey, checked) => {
        await this.applySettings({
          ...this.settingsData,
          [settingKey]: checked,
        })
      },
      onHotkeyChange: async (settingKey, value) => {
        return await this.updateHotkeySetting(settingKey, value)
      },
      onNumberChange: async (settingKey, value) => {
        return await this.updateNumberSetting(settingKey, value)
      },
      setting,
      settings: this.getRuntimeHotkeySettings(),
    })

    setting.open(this.name)
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
    syncPanelCommandHotkeys({
      commands: this.commands,
      settings: this.settingsData,
      toRegisteredHotkey: this.toRegisteredHotkey.bind(this),
    })
  }

  private toRegisteredHotkey(hotkey: string) {
    const normalizedHotkey = normalizeHotkey(hotkey) || hotkey
    return adaptHotkey(normalizedHotkey)
  }

  private openPanelFromCommand(
    replaceVisible?: boolean,
    protyle?: {
      block?: {
        rootID?: string
      }
      element?: HTMLElement
    },
  ) {
    openSearchReplacePanelFromCommand(replaceVisible, protyle)
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
    const runtimeHotkeySettings = this.getRuntimeHotkeySettings()
    const ignoredHotkeys = buildIgnoredHotkeys({
      commands: this.commands,
      settingKey,
      settingsData: runtimeHotkeySettings,
    })
    return findHotkeyConflict(hotkey, this.getKnownHotkeySources(settingKey), ignoredHotkeys)
  }

  private getKnownHotkeySources(settingKey: HotkeySettingKey): HotkeySource[] {
    const keymapSources = this.getKeymapHotkeySources()
    return buildKnownHotkeySources({
      commands: this.commands,
      keymapSources,
      settingKey,
    })
  }

  private getKeymapHotkeySources() {
    return collectKeymapHotkeys((window as any).siyuan?.config?.keymap)
  }

  private getRuntimeHotkeySettings() {
    return resolveHotkeySettingsFromRuntime({
      commands: this.commands,
      keymapSources: this.getKeymapHotkeySources(),
      settings: this.settingsData,
    })
  }

  private createCheckbox(checked: boolean, onChange: (checked: boolean) => Promise<void>) {
    return createCheckboxElement(checked, onChange)
  }

  private async updateNumberSetting(settingKey: NumberSettingKey, value: number) {
    await this.applySettings({
      ...this.settingsData,
      [settingKey]: value,
    })
    return true
  }

  private createNumberInput(value: number, onChange: (value: number) => Promise<boolean>) {
    return createNumberInputElement(value, onChange)
  }
}
