import { vi } from 'vitest'

export interface IProtyle {
  block?: {
    rootID?: string
  }
  element?: HTMLElement
  scroll?: {
    updateIndex?: (protyle: IProtyle, id: string, cb?: (index: number) => void) => void
  }
}

export const fetchSyncPost = vi.fn(async () => ({
  code: 0,
  data: null,
  msg: '',
}))

export const getFrontend = vi.fn(() => 'desktop')
export const openMobileFileById = vi.fn()
export const openTab = vi.fn(async () => ({}))

export const showMessage = vi.fn()

export const adaptHotkey = vi.fn((hotkey: string) => {
  const tokens = hotkey.split('+').map(token => token.trim()).filter(Boolean)
  const modifierMap: Record<string, string> = {
    Win: '⌃',
    Alt: '⌥',
    Shift: '⇧',
    Ctrl: '⌘',
  }
  const modifierOrder = ['Win', 'Alt', 'Shift', 'Ctrl']
  const modifiers = modifierOrder
    .filter(modifier => tokens.includes(modifier))
    .map(modifier => modifierMap[modifier] ?? '')
    .join('')
  const key = tokens.find(token => !modifierOrder.includes(token)) ?? ''
  return `${modifiers}${key}`
})

export class Setting {
  addItem() {
    return this
  }

  open() {}
}

export class Plugin {
  public commands: any[] = []
  public eventBus = {
    off() {},
    on() {},
  }
  public i18n: Record<string, string> = {}

  addCommand(command: any) {
    this.commands.push(command)
  }

  addIcons() {}

  addTopBar() {
    return document.createElement('button')
  }

  async loadData() {
    return null
  }

  async removeData() {
    return null
  }

  async saveData() {}
}
