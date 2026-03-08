// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  collectKeymapHotkeys,
  findHotkeyConflict,
  formatHotkeyFromEvent,
  normalizeHotkey,
} from '@/hotkeys'

describe('hotkey helpers', () => {
  it('formats a keyboard event into a SiYuan-style hotkey string', () => {
    const event = new KeyboardEvent('keydown', {
      ctrlKey: true,
      key: 'h',
      shiftKey: true,
    })

    expect(formatHotkeyFromEvent(event)).toBe('Ctrl+Shift+H')
  })

  it('ignores modifier-only key presses', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'Shift',
      shiftKey: true,
    })

    expect(formatHotkeyFromEvent(event)).toBeNull()
  })

  it('normalizes legacy symbol shortcuts into Windows-friendly labels', () => {
    expect(normalizeHotkey('⌘⇧F')).toBe('Ctrl+Shift+F')
    expect(normalizeHotkey('Meta+Shift+F')).toBe('Win+Shift+F')
    expect(normalizeHotkey('Ctrl+Shift+H')).toBe('Ctrl+Shift+H')
  })

  it('collects configured keymap hotkeys and finds conflicts', () => {
    const sources = collectKeymapHotkeys({
      editor: {
        general: {
          search: {
            custom: 'Ctrl+P',
            default: 'Ctrl+F',
          },
        },
      },
      general: {
        window: {
          custom: '',
          default: 'Alt+W',
        },
      },
      plugin: {},
    })

    expect(sources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        hotkey: 'Ctrl+P',
        label: 'editor.general.search',
      }),
      expect.objectContaining({
        hotkey: 'Alt+W',
        label: 'general.window',
      }),
    ]))

    expect(findHotkeyConflict('Ctrl+P', sources)).toEqual(expect.objectContaining({
      hotkey: 'Ctrl+P',
      label: 'editor.general.search',
    }))
    expect(findHotkeyConflict('Ctrl+Shift+P', sources)).toBeNull()
  })
})
