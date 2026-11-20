// @vitest-environment node

import { Plugin } from 'siyuan'

import {
  describe,
  expect,
  it,
} from 'vitest'

import { loadSettings } from '@/settings'

describe('default hotkey settings', () => {
  it('loads normalized default panel hotkeys when storage is empty', async () => {
    // 类型层的 siyuan Plugin 是抽象类；vitest 运行时经 alias 用 tests/mocks/siyuan.ts 的具体实现
    const PluginClass = Plugin as unknown as new () => Plugin
    const plugin = new PluginClass()

    await expect(loadSettings(plugin)).resolves.toEqual(expect.objectContaining({
      panelHotkey: 'Ctrl+F11',
      replacePanelHotkey: 'Ctrl+F12',
    }))
  })
})
