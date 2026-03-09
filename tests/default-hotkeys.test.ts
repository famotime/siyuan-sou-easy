import {
  describe,
  expect,
  it,
} from 'vitest'

import { Plugin } from 'siyuan'

import { loadSettings } from '@/settings'

describe('default hotkey settings', () => {
  it('loads normalized default panel hotkeys when storage is empty', async () => {
    const plugin = new Plugin()

    await expect(loadSettings(plugin)).resolves.toEqual(expect.objectContaining({
      panelHotkey: 'Ctrl+F11',
      replacePanelHotkey: 'Ctrl+F12',
    }))
  })
})
