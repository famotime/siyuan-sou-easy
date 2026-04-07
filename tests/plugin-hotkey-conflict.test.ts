import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  buildIgnoredHotkeys,
  getIgnoredCommandLangKeys,
} from '@/features/search-replace/plugin-hotkey-conflict'

describe('plugin hotkey conflict helpers', () => {
  it('ignores only the matching command lang key for the edited setting', () => {
    expect(getIgnoredCommandLangKeys('panelHotkey')).toEqual(['togglePanel'])
    expect(getIgnoredCommandLangKeys('replacePanelHotkey')).toEqual(['toggleReplacePanel'])
  })

  it('collects the current setting hotkey and matching command hotkeys into the ignore list', () => {
    expect(buildIgnoredHotkeys({
      commands: [
        {
          customHotkey: 'Ctrl+Shift+F',
          hotkey: 'Ctrl+Shift+F',
          langKey: 'togglePanel',
        },
        {
          customHotkey: 'Ctrl+Shift+H',
          hotkey: 'Ctrl+Shift+H',
          langKey: 'toggleReplacePanel',
        },
        {
          customHotkey: 'Ctrl+P',
          hotkey: 'Ctrl+P',
          langKey: 'plugin.other',
        },
      ],
      settingKey: 'panelHotkey',
      settingsData: {
        panelHotkey: 'Ctrl+Shift+F',
        replacePanelHotkey: 'Ctrl+Shift+H',
      },
    })).toEqual(['Ctrl+Shift+F', 'Ctrl+Shift+F'])
  })
})
