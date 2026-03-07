import {
  Plugin,
  getFrontend,
  showMessage,
} from 'siyuan'
import '@/index.scss'
import PluginInfoString from '@/../plugin.json'
import {
  onEditorContextChanged,
  openPanel,
} from '@/features/search-replace/store'
import {
  destroy,
  init,
} from '@/main'

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
      hotkey: '⌘⇧F',
      callback: () => {
        openPanel(true)
      },
    })

    this.addCommand({
      langKey: 'toggleReplacePanel',
      hotkey: '⌘⇧H',
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
    showMessage(this.i18n.settingComingSoon, 3000, 'info')
  }
}
