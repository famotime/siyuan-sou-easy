import {
  Plugin,
  Setting,
  getFrontend,
  showMessage,
} from 'siyuan'
import '@/index.scss'
import PluginInfoString from '@/../plugin.json'
import {
  applyPluginSettings,
  onEditorContextChanged,
  openPanel,
} from '@/features/search-replace/store'
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

  private readonly handleEditorEvent = () => {
    onEditorContextChanged()
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

    this.addTopBar({
      icon: 'iconSearch',
      title: this.i18n.addTopBarIcon,
      callback: () => {
        openPanel()
      },
    })

    this.addCommand({
      langKey: 'togglePanel',
      hotkey: DEFAULT_SETTINGS.panelHotkey,
      customHotkey: this.settingsData.panelHotkey,
      callback: () => {
        openPanel(true)
      },
    })

    this.addCommand({
      langKey: 'toggleReplacePanel',
      hotkey: DEFAULT_SETTINGS.replacePanelHotkey,
      customHotkey: this.settingsData.replacePanelHotkey,
      callback: () => {
        openPanel(true, true)
      },
    })

    this.eventBus.on('switch-protyle', this.handleEditorEvent)
    this.eventBus.on('loaded-protyle-static', this.handleEditorEvent)
    this.eventBus.on('destroy-protyle', this.handleEditorEvent)
  }

  onunload() {
    this.eventBus.off('switch-protyle', this.handleEditorEvent)
    this.eventBus.off('loaded-protyle-static', this.handleEditorEvent)
    this.eventBus.off('destroy-protyle', this.handleEditorEvent)
    destroy()
  }

  openSetting() {
    const setting = new Setting({
      width: '620px',
    })

    setting.addItem({
      title: this.i18n.settingPanelHotkeyTitle,
      description: this.i18n.settingPanelHotkeyDesc,
      createActionElement: () => this.createTextInput(this.settingsData.panelHotkey, async (value) => {
        await this.applySettings({
          ...this.settingsData,
          panelHotkey: value,
        })
      }),
    })

    setting.addItem({
      title: this.i18n.settingReplaceHotkeyTitle,
      description: this.i18n.settingReplaceHotkeyDesc,
      createActionElement: () => this.createTextInput(this.settingsData.replacePanelHotkey, async (value) => {
        await this.applySettings({
          ...this.settingsData,
          replacePanelHotkey: value,
        })
      }),
    })

    setting.addItem({
      title: this.i18n.settingDefaultReplaceVisibleTitle,
      description: this.i18n.settingDefaultReplaceVisibleDesc,
      createActionElement: () => this.createCheckbox(this.settingsData.defaultReplaceVisible, async (checked) => {
        await this.applySettings({
          ...this.settingsData,
          defaultReplaceVisible: checked,
        })
      }),
    })

    setting.addItem({
      title: this.i18n.settingRememberPositionTitle,
      description: this.i18n.settingRememberPositionDesc,
      createActionElement: () => this.createCheckbox(this.settingsData.rememberPanelPosition, async (checked) => {
        await this.applySettings({
          ...this.settingsData,
          rememberPanelPosition: checked,
        })
      }),
    })

    setting.addItem({
      title: this.i18n.settingPreloadSelectionTitle,
      description: this.i18n.settingPreloadSelectionDesc,
      createActionElement: () => this.createCheckbox(this.settingsData.preloadSelection, async (checked) => {
        await this.applySettings({
          ...this.settingsData,
          preloadSelection: checked,
        })
      }),
    })

    setting.addItem({
      title: this.i18n.settingIncludeCodeBlockTitle,
      description: this.i18n.settingIncludeCodeBlockDesc,
      createActionElement: () => this.createCheckbox(this.settingsData.includeCodeBlock, async (checked) => {
        await this.applySettings({
          ...this.settingsData,
          includeCodeBlock: checked,
        })
      }),
    })

    setting.addItem({
      title: this.i18n.settingDebugLogTitle,
      description: this.i18n.settingDebugLogDesc,
      createActionElement: () => this.createCheckbox(this.settingsData.debugLog, async (checked) => {
        await this.applySettings({
          ...this.settingsData,
          debugLog: checked,
        })
      }),
    })

    setting.addItem({
      title: this.i18n.settingPreserveCaseTitle,
      description: this.i18n.settingPreserveCaseDesc,
      createActionElement: () => this.createCheckbox(this.settingsData.preserveCase, async (checked) => {
        await this.applySettings({
          ...this.settingsData,
          preserveCase: checked,
        })
      }),
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
      panelCommand.hotkey = DEFAULT_SETTINGS.panelHotkey
      panelCommand.customHotkey = this.settingsData.panelHotkey
    }

    const replaceCommand = this.commands.find(command => command.langKey === 'toggleReplacePanel')
    if (replaceCommand) {
      replaceCommand.hotkey = DEFAULT_SETTINGS.replacePanelHotkey
      replaceCommand.customHotkey = this.settingsData.replacePanelHotkey
    }
  }

  private createTextInput(value: string, onChange: (value: string) => Promise<void>) {
    const input = document.createElement('input')
    input.className = 'b3-text-field fn__size200'
    input.value = value
    input.placeholder = '例如：⌘⇧F'
    input.addEventListener('change', async () => {
      await onChange(input.value)
    })
    return input
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
