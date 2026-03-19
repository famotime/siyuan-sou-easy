import {
  Plugin,
  Setting,
  adaptHotkey,
  getFrontend,
  showMessage,
} from 'siyuan'
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
import {
  type HotkeySettingKey,
} from '@/features/search-replace/settings-panel'
import {
  createPanelCommands,
  syncPanelCommandHotkeys,
} from '@/features/search-replace/plugin-command-config'
import { registerSearchReplaceSettings } from '@/features/search-replace/plugin-settings-ui'
import {
  applyPluginSettings,
  onEditorContextChanged,
  openPanel,
  searchReplaceState,
} from '@/features/search-replace/store'
import { UI_STATE_STORAGE } from '@/features/search-replace/store/ui-state'
import {
  createEditorContextFromElement,
  createEditorContextFromProtyleLike,
} from '@/features/search-replace/editor'
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

const HOTKEY_CAPTURE_INPUT_ATTRIBUTE = 'data-friendly-search-hotkey-input'

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
    protyle?: {
      block?: {
        rootID?: string
      }
      element?: HTMLElement
    }
  }>) => {
    onEditorContextChanged(createEditorContextFromProtyleLike(event?.detail?.protyle))
  }

  private readonly openFindPanelCommand = () => {
    this.openPanelFromCommand(false)
  }

  private readonly openReplacePanelCommand = () => {
    this.openPanelFromCommand(true)
  }

  private readonly openFindPanelFromEditorCommand = (protyle: {
    block?: {
      rootID?: string
    }
    element?: HTMLElement
  }) => {
    this.openPanelFromCommand(false, protyle)
  }

  private readonly openReplacePanelFromEditorCommand = (protyle: {
    block?: {
      rootID?: string
    }
    element?: HTMLElement
  }) => {
    this.openPanelFromCommand(true, protyle)
  }

  private readonly handleDocumentKeydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) {
      return
    }

    const target = event.target instanceof Element ? event.target : null
    if (target?.closest(`[${HOTKEY_CAPTURE_INPUT_ATTRIBUTE}="true"]`)) {
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

    if (normalizedHotkey === this.settingsData.panelHotkey) {
      event.preventDefault()
      event.stopPropagation()
      this.openPanelFromKeyboardEvent(event, false)
      return
    }

    if (normalizedHotkey === this.settingsData.replacePanelHotkey) {
      event.preventDefault()
      event.stopPropagation()
      this.openPanelFromKeyboardEvent(event, true)
    }
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
      setting,
      settings: this.settingsData,
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
    if (protyle) {
      onEditorContextChanged(createEditorContextFromProtyleLike(protyle))
    }

    this.togglePanel(replaceVisible)
  }

  private openPanelFromKeyboardEvent(event: KeyboardEvent, replaceVisible?: boolean) {
    const target = event.target instanceof Element ? event.target : null
    const protyle = target?.closest('.protyle')
    const context = createEditorContextFromElement(protyle instanceof HTMLElement ? protyle : null)
    if (context) {
      onEditorContextChanged(context)
    }

    this.togglePanel(replaceVisible)
  }

  private togglePanel(replaceVisible?: boolean) {
    if (!searchReplaceState.visible) {
      openPanel(true, replaceVisible)
      return
    }

    const shouldClose = replaceVisible === searchReplaceState.replaceVisible
    openPanel(!shouldClose, replaceVisible)
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
    const input = document.createElement('input')
    input.className = 'b3-text-field fn__size200'
    input.autocomplete = 'off'
    input.setAttribute(HOTKEY_CAPTURE_INPUT_ATTRIBUTE, 'true')
    input.placeholder = '\u70b9\u51fb\u540e\u6309\u4e0b\u5feb\u6377\u952e'
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

  private findHotkeySettingConflict(settingKey: HotkeySettingKey, hotkey: string) {
    const ignoredLangKeys = settingKey === 'panelHotkey' ? ['togglePanel'] : ['toggleReplacePanel']
    const ignoredHotkeys = [
      this.settingsData[settingKey],
      ...this.commands
        .filter(cmd => ignoredLangKeys.includes(cmd.langKey || ''))
        .map(cmd => cmd.customHotkey || cmd.hotkey)
        .filter(Boolean),
    ]
    return findHotkeyConflict(hotkey, this.getKnownHotkeySources(settingKey), ignoredHotkeys)
  }

  private getKnownHotkeySources(settingKey: HotkeySettingKey): HotkeySource[] {
    const ignoredLangKey = settingKey === 'panelHotkey' ? 'togglePanel' : 'toggleReplacePanel'
    const commandSources = this.commands
      .filter(command => command.langKey !== ignoredLangKey)
      .map(command => ({
        hotkey: command.customHotkey || command.hotkey,
        label: command.langKey || 'plugin.command',
      }))
      .filter(command => Boolean(command.hotkey)) as HotkeySource[]

    const keymapSources = collectKeymapHotkeys((window as any).siyuan?.config?.keymap)
    return [...commandSources, ...keymapSources]
  }

  private createCheckbox(checked: boolean, onChange: (checked: boolean) => Promise<void>) {
    const input = document.createElement('input')
    input.className = 'b3-switch fn__flex-center'
    input.type = 'checkbox'
    input.checked = checked
    input.addEventListener('change', async () => {
      await onChange(input.checked)
    })
    return input
  }
}
