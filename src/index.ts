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
  BOOLEAN_SETTING_DEFINITIONS,
  HOTKEY_SETTING_DEFINITIONS,
  type HotkeySettingKey,
} from '@/features/search-replace/settings-panel'
import {
  applyPluginSettings,
  onEditorContextChanged,
  openPanel,
} from '@/features/search-replace/store'
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
      this.openPanelFromKeyboardEvent(event)
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

    this.addCommand({
      langKey: 'togglePanel',
      hotkey: this.toRegisteredHotkey(DEFAULT_SETTINGS.panelHotkey),
      customHotkey: this.toRegisteredHotkey(this.settingsData.panelHotkey),
      callback: this.openFindPanelCommand,
      dockCallback: this.openFindPanelCommand,
      editorCallback: this.openFindPanelFromEditorCommand,
      fileTreeCallback: this.openFindPanelCommand,
    })

    this.addCommand({
      langKey: 'toggleReplacePanel',
      hotkey: this.toRegisteredHotkey(DEFAULT_SETTINGS.replacePanelHotkey),
      customHotkey: this.toRegisteredHotkey(this.settingsData.replacePanelHotkey),
      callback: this.openReplacePanelCommand,
      dockCallback: this.openReplacePanelCommand,
      editorCallback: this.openReplacePanelFromEditorCommand,
      fileTreeCallback: this.openReplacePanelCommand,
    })

    bindEditorContextEvents(this.eventBus, this.handleEditorEvent)
    window.addEventListener('keydown', this.handleDocumentKeydown, true)
  }

  onunload() {
    unbindEditorContextEvents(this.eventBus, this.handleEditorEvent)
    window.removeEventListener('keydown', this.handleDocumentKeydown, true)
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
      panelCommand.hotkey = this.toRegisteredHotkey(DEFAULT_SETTINGS.panelHotkey)
      panelCommand.customHotkey = this.toRegisteredHotkey(this.settingsData.panelHotkey)
    }

    const replaceCommand = this.commands.find(command => command.langKey === 'toggleReplacePanel')
    if (replaceCommand) {
      replaceCommand.hotkey = this.toRegisteredHotkey(DEFAULT_SETTINGS.replacePanelHotkey)
      replaceCommand.customHotkey = this.toRegisteredHotkey(this.settingsData.replacePanelHotkey)
    }
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

    openPanel(true, replaceVisible)
  }

  private openPanelFromKeyboardEvent(event: KeyboardEvent, replaceVisible?: boolean) {
    const target = event.target instanceof Element ? event.target : null
    const protyle = target?.closest('.protyle')
    const context = createEditorContextFromElement(protyle instanceof HTMLElement ? protyle : null)
    if (context) {
      onEditorContextChanged(context)
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
