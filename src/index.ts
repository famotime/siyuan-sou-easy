import {
  Plugin,
  Setting,
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
  toCommandHotkey,
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
  BOOLEAN_SETTING_DEFINITIONS,
  HOTKEY_SETTING_DEFINITIONS,
  type HotkeySettingKey,
} from '@/features/search-replace/settings-panel'
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

  private readonly openFindPanelCommand = () => {
    this.openPanelFromCommand()
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
    this.openPanelFromCommand(undefined, protyle)
  }

  private readonly openReplacePanelFromEditorCommand = (protyle: {
    block?: {
      rootID?: string
    }
    element?: HTMLElement
  }) => {
    this.openPanelFromCommand(true, protyle)
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

    this.addCommand({
      langKey: 'togglePanel',
      hotkey: toCommandHotkey(DEFAULT_SETTINGS.panelHotkey),
      customHotkey: toCommandHotkey(this.settingsData.panelHotkey),
      callback: this.openFindPanelCommand,
      dockCallback: this.openFindPanelCommand,
      editorCallback: this.openFindPanelFromEditorCommand,
      fileTreeCallback: this.openFindPanelCommand,
    })

    this.addCommand({
      langKey: 'toggleReplacePanel',
      hotkey: toCommandHotkey(DEFAULT_SETTINGS.replacePanelHotkey),
      customHotkey: toCommandHotkey(this.settingsData.replacePanelHotkey),
      callback: this.openReplacePanelCommand,
      dockCallback: this.openReplacePanelCommand,
      editorCallback: this.openReplacePanelFromEditorCommand,
      fileTreeCallback: this.openReplacePanelCommand,
    })

    bindEditorContextEvents(this.eventBus, this.handleEditorEvent)
  }

  onunload() {
    unbindEditorContextEvents(this.eventBus, this.handleEditorEvent)
    destroy()
  }

  openSetting() {
    const setting = new Setting({
      width: '620px',
    })

    HOTKEY_SETTING_DEFINITIONS.forEach(({ descriptionKey, settingKey, titleKey }) => {
      setting.addItem({
        title: this.i18n[titleKey],
        description: this.i18n[descriptionKey],
        createActionElement: () => this.createHotkeyInput(this.settingsData[settingKey], async (value) => {
          return await this.updateHotkeySetting(settingKey, value)
        }),
      })
    })

    BOOLEAN_SETTING_DEFINITIONS.forEach(({ descriptionKey, settingKey, titleKey }) => {
      setting.addItem({
        title: this.i18n[titleKey],
        description: this.i18n[descriptionKey],
        createActionElement: () => this.createCheckbox(this.settingsData[settingKey], async (checked) => {
          await this.applySettings({
            ...this.settingsData,
            [settingKey]: checked,
          })
        }),
      })
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
    const panelCommand = this.commands.find(command => command.langKey === 'togglePanel')
    if (panelCommand) {
      panelCommand.hotkey = toCommandHotkey(DEFAULT_SETTINGS.panelHotkey)
      panelCommand.customHotkey = toCommandHotkey(this.settingsData.panelHotkey)
    }

    const replaceCommand = this.commands.find(command => command.langKey === 'toggleReplacePanel')
    if (replaceCommand) {
      replaceCommand.hotkey = toCommandHotkey(DEFAULT_SETTINGS.replacePanelHotkey)
      replaceCommand.customHotkey = toCommandHotkey(this.settingsData.replacePanelHotkey)
    }
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

    openPanel(true, replaceVisible)
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
    const ignoredHotkeys = [this.settingsData[settingKey]]
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
