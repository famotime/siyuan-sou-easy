import { vi } from 'vitest'

export const fetchSyncPost = vi.fn(async () => ({
  code: 0,
  data: null,
  msg: '',
}))

export const getFrontend = vi.fn(() => 'desktop')

export const showMessage = vi.fn()

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
