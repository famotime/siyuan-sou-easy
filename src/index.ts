import type { IProtyle } from 'siyuan'
import type { EditorProtyleLike } from '@/features/search-replace/plugin-panel-launch'
import type {
  ColorSettingKey,
  HotkeySettingKey,
  NumberSettingKey,
} from '@/features/search-replace/settings-panel'
import type { HotkeySource } from '@/hotkeys'
import type { PluginSettings } from '@/settings'
import {
  adaptHotkey,
  Plugin,
  Setting,
  showMessage,
} from 'siyuan'
import PluginInfoString from '@/../plugin.json'
import { createEditorContextFromProtyleLike } from '@/features/search-replace/editor'
import {
  closeGlobalSearchDockAndReturnFocus,
  destroyGlobalSearchDock,
  initGlobalSearchDock,
  toggleGlobalSearchDock,
} from '@/features/search-replace/global/dock-manager'
import {
  destroyReplaceHistoryTab,
  initReplaceHistoryTab,
  REPLACE_HISTORY_TAB_TYPE,
} from '@/features/search-replace/global/history-tab-manager'
import { PRESETS_STORAGE } from '@/features/search-replace/global/saved-presets'
import { TRANSACTION_STORAGE } from '@/features/search-replace/global/transaction-history'
import { setKeymap } from '@/features/search-replace/kernel'
import { buildLunariaBusRegistration } from '@/features/search-replace/lunaria-bus'
import {
  createPanelCommands,
  resolveHotkeySettingsFromRuntime,
  syncPanelCommandHotkeys,
  updatePanelCommandKeymap,
} from '@/features/search-replace/plugin-command-config'
import { detectPluginEnvironment } from '@/features/search-replace/plugin-environment'
import {
  bindEditorContextEvents,
  unbindEditorContextEvents,
} from '@/features/search-replace/plugin-events'
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
  createCheckboxElement,
  createColorSettingElement,
  createHotkeyInputElement,
  createNumberInputElement,
  HOTKEY_CAPTURE_INPUT_ATTRIBUTE,
} from '@/features/search-replace/plugin-setting-elements'
import { registerSearchReplaceSettings } from '@/features/search-replace/plugin-settings-ui'
import {
  applyPluginSettings,
  closePanel,
  onEditorContextChanged,
  openPanel,
  searchReplaceState,
} from '@/features/search-replace/store'
import { UI_STATE_STORAGE } from '@/features/search-replace/store/ui-state'
import { createTtlCache } from '@/features/search-replace/ttl-cache'
import {
  collectKeymapHotkeys,
  findHotkeyConflict,
  formatHotkeyFromEvent,

  normalizeHotkey,
} from '@/hotkeys'
import { t } from '@/i18n/runtime'
import {
  SEARCH_REPLACE_TOP_BAR_ICON,
  SEARCH_REPLACE_TOP_BAR_ICON_ID,
} from '@/icons'
import {
  destroy,
  init,
} from '@/main'
import {
  DEFAULT_SEARCH_HIGHLIGHT_COLOR,
  DEFAULT_SETTINGS,
  isSupportedSearchHighlightColor,
  loadSettings,
  normalizeSettings,

  saveSettings,
  SETTINGS_STORAGE,
} from '@/settings'
import '@/index.scss'

const { version } = PluginInfoString

export default class FriendlySearchReplacePlugin extends Plugin {
  public isMobile: boolean
  public isBrowser: boolean
  public isLocal: boolean
  public isElectron: boolean
  public isInWindow: boolean
  public platform: SyFrontendTypes
  public readonly version = version
  private settingsData: PluginSettings = { ...DEFAULT_SETTINGS }
  private _onLunariaBusReady: (() => void) | null = null

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
    // 快捷键捕获输入框自身管理 Escape（取消捕获并恢复原值），
    // 必须在面板 Escape 拦截之前放行，否则捕获框内按 Esc 会误关面板
    if (isHotkeyCaptureTarget(target, HOTKEY_CAPTURE_INPUT_ATTRIBUTE)) {
      return
    }

    if (event.key === 'Escape') {
      if (searchReplaceState.visible) {
        event.preventDefault()
        event.stopPropagation()
        closePanel()
        return
      }
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

    if (normalizedHotkey === runtimeHotkeySettings.globalSearchHotkey) {
      if (this.isMobile) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      toggleGlobalSearchDock(false)
      return
    }

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
    // 先 init（内部完成 bindUiStatePlugin）再应用设置：
    // 否则 applyPluginSettings 中 rememberPanelPosition=false 的清盘写入
    // 会因实例未绑定而被静默丢弃
    await init(this)
    applyPluginSettings(this.settingsData)

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
    panelCommands.forEach((command) => this.addCommand(command))

    if (!this.isMobile) {
      this.addCommand({
        callback: () => {
          toggleGlobalSearchDock(false)
        },
        hotkey: this.toRegisteredHotkey(this.settingsData.globalSearchHotkey || 'Ctrl+Shift+F'),
        langKey: 'openGlobalSearch',
      })
    }

    if (!this.isMobile && typeof (this as any).addDock === 'function') {
      this.addDock({
        config: {
          hotkey: this.toRegisteredHotkey(this.settingsData.globalSearchHotkey || 'Ctrl+Shift+F'),
          icon: SEARCH_REPLACE_TOP_BAR_ICON_ID,
          position: 'RightTop',
          size: {
            height: 0,
            width: 340,
          },
          title: this.i18n.globalSearchDockTitle || '搜 easy 全库搜索',
        },
        data: {},
        destroy: () => {
          destroyGlobalSearchDock()
        },
        init: (dock: any) => {
          if (dock?.element) {
            initGlobalSearchDock(dock.element)
          }
        },
        type: 'siyuan-sou-easy-dock-tab',
      })
    }

    if (!this.isMobile && typeof (this as any).addTab === 'function') {
      // 思源运行时把 Custom 实例作为首参传入 init/destroy（见 app/src/layout/dock/Custom.ts 的 this.init(this)），
      // 官方 d.ts 却标注为 (this: Custom)，这里按运行时行为处理并收敛类型。
      this.addTab({
        type: REPLACE_HISTORY_TAB_TYPE,
        init: ((custom: { element?: Element }) => {
          if (custom?.element) {
            initReplaceHistoryTab(custom.element as HTMLElement)
          }
        }) as unknown as () => void,
        destroy: ((custom: { element?: Element }) => {
          if (custom?.element) {
            destroyReplaceHistoryTab(custom.element as HTMLElement)
          }
        }) as unknown as () => void,
      })
    }

    bindEditorContextEvents(this.eventBus, this.handleEditorEvent)
    window.addEventListener('keydown', this.handleDocumentKeydown, true)
    this.registerToLunariaBus()
  }

  onunload() {
    if (this._onLunariaBusReady) {
      window.removeEventListener('lunaria-bus-ready', this._onLunariaBusReady)
      this._onLunariaBusReady = null
    }
    if ((window as any).siyuanLunariaBus?.unregister) {
      try {
        (window as any).siyuanLunariaBus.unregister(this.name || 'siyuan-sou-easy')
      } catch {}
    }
    closeGlobalSearchDockAndReturnFocus()
    destroyGlobalSearchDock()
    unbindEditorContextEvents(this.eventBus, this.handleEditorEvent)
    window.removeEventListener('keydown', this.handleDocumentKeydown, true)
    destroy()
  }

  async uninstall() {
    await this.removeData(SETTINGS_STORAGE)
    await this.removeData(UI_STATE_STORAGE)
    await this.removeData(PRESETS_STORAGE)
    await this.removeData(TRANSACTION_STORAGE)
  }

  openSetting() {
    const setting = new Setting({
      width: '620px',
    })

    registerSearchReplaceSettings({
      createCheckbox: this.createCheckbox.bind(this),
      createColorSetting: this.createColorSetting.bind(this),
      createHotkeyInput: this.createHotkeyInput.bind(this),
      createNumberInput: this.createNumberInput.bind(this),
      i18n: this.i18n,
      onBooleanChange: async (settingKey, checked) => {
        await this.applySettings({
          ...this.settingsData,
          [settingKey]: checked,
        })
      },
      onColorChange: async (settingKey, value) => {
        return await this.updateColorSetting(settingKey, value)
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
    this.invalidateRuntimeHotkeySettingsCache()
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
    protyle?: EditorProtyleLike,
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
      showMessage(t('hotkeyConflict', {
        0: normalizedHotkey,
        1: conflict.label,
      }), 4000, 'error')
      return false
    }

    try {
      await this.syncHotkeySettingToKeymap(settingKey, normalizedHotkey)
    } catch {
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

  // handleDocumentKeydown 在每次按键时读取运行时快捷键，
  // resolveHotkeySettingsFromRuntime 会全量遍历思源 keymap 树，这里做短 TTL 缓存。
  // 插件自身的设置/快捷键写入会主动失效；外部（思源设置面板）改键最多延迟一个 TTL。
  private static readonly RUNTIME_HOTKEY_CACHE_TTL_MS = 5000

  private runtimeHotkeySettingsCache = createTtlCache<ReturnType<typeof resolveHotkeySettingsFromRuntime>>(
    FriendlySearchReplacePlugin.RUNTIME_HOTKEY_CACHE_TTL_MS,
  )

  private invalidateRuntimeHotkeySettingsCache() {
    this.runtimeHotkeySettingsCache.invalidate()
  }

  private getRuntimeHotkeySettings() {
    const cached = this.runtimeHotkeySettingsCache.get('runtime')
    if (cached !== undefined) {
      return cached
    }

    const value = resolveHotkeySettingsFromRuntime({
      commands: this.commands,
      keymapSources: this.getKeymapHotkeySources(),
      settings: this.settingsData,
    })
    this.runtimeHotkeySettingsCache.set('runtime', value)
    return value
  }

  private createCheckbox(checked: boolean, onChange: (checked: boolean) => Promise<void>) {
    return createCheckboxElement(checked, onChange)
  }

  private async updateColorSetting(settingKey: ColorSettingKey, value: string) {
    const normalizedValue = value.trim()
    if (!isSupportedSearchHighlightColor(normalizedValue)) {
      return false
    }

    await this.applySettings({
      ...this.settingsData,
      [settingKey]: normalizedValue,
    })
    return true
  }

  private async syncHotkeySettingToKeymap(settingKey: HotkeySettingKey, hotkey: string) {
    const siyuanConfig = (window as any).siyuan?.config
    const nextKeymap = updatePanelCommandKeymap({
      hotkey,
      keymap: siyuanConfig?.keymap,
      settingKey,
    })
    if (!nextKeymap) {
      return
    }

    await setKeymap(nextKeymap)
    siyuanConfig.keymap = nextKeymap
    this.invalidateRuntimeHotkeySettingsCache()
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

  private createColorSetting(value: string, onChange: (value: string) => Promise<boolean>) {
    return createColorSettingElement(
      value,
      DEFAULT_SEARCH_HIGHLIGHT_COLOR,
      this.i18n.settingSearchHighlightColorReset,
      onChange,
    )
  }

  public registerToLunariaBus(): void {
    if (typeof window === 'undefined') return
    const register = () => {
      const bus = (window as any).siyuanLunariaBus
      if (bus && typeof bus.register === 'function') {
        bus.register(buildLunariaBusRegistration({
          id: this.name || 'siyuan-sou-easy',
          name: '搜 easy',
          version: this.version || '2.0.0',
        }))
      }
    }

    register()
    if (!this._onLunariaBusReady) {
      this._onLunariaBusReady = () => register()
      window.addEventListener('lunaria-bus-ready', this._onLunariaBusReady)
    }
  }
}
