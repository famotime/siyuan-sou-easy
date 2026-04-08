import type { Setting } from 'siyuan'
import {
  BOOLEAN_SETTING_DEFINITIONS,
  HOTKEY_SETTING_DEFINITIONS,
  NUMBER_SETTING_DEFINITIONS,
  type HotkeySettingKey,
  type NumberSettingKey,
} from './settings-panel'
import type { PluginSettings } from '@/settings'

export function registerSearchReplaceSettings({
  createCheckbox,
  createHotkeyInput,
  createNumberInput,
  i18n,
  onBooleanChange,
  onHotkeyChange,
  onNumberChange,
  setting,
  settings,
}: {
  createCheckbox: (checked: boolean, onChange: (checked: boolean) => Promise<void>) => HTMLInputElement
  createHotkeyInput: (value: string, onChange: (value: string) => Promise<boolean>) => HTMLInputElement
  createNumberInput: (value: number, onChange: (value: number) => Promise<boolean>) => HTMLInputElement
  i18n: Record<string, string>
  onBooleanChange: <TKey extends BooleanSettingKey>(settingKey: TKey, checked: boolean) => Promise<void>
  onHotkeyChange: (settingKey: HotkeySettingKey, value: string) => Promise<boolean>
  onNumberChange: (settingKey: NumberSettingKey, value: number) => Promise<boolean>
  setting: Setting
  settings: PluginSettings
}) {
  HOTKEY_SETTING_DEFINITIONS.forEach(({ descriptionKey, settingKey, titleKey }) => {
    setting.addItem({
      title: i18n[titleKey],
      description: i18n[descriptionKey],
      createActionElement: () => createHotkeyInput(settings[settingKey], async (value) => {
        return await onHotkeyChange(settingKey, value)
      }),
    })
  })

  BOOLEAN_SETTING_DEFINITIONS.forEach(({ descriptionKey, settingKey, titleKey }) => {
    setting.addItem({
      title: i18n[titleKey],
      description: i18n[descriptionKey],
      createActionElement: () => createCheckbox(settings[settingKey], async (checked) => {
        await onBooleanChange(settingKey, checked)
      }),
    })

    if (settingKey !== 'optimizeLargeCodeBlocks') {
      return
    }

    NUMBER_SETTING_DEFINITIONS.forEach(({ descriptionKey, settingKey, titleKey }) => {
      setting.addItem({
        title: i18n[titleKey],
        description: i18n[descriptionKey],
        createActionElement: () => createNumberInput(settings[settingKey], async (value) => {
          return await onNumberChange(settingKey, value)
        }),
      })
    })
  })
}

type BooleanSettingKey = Extract<keyof PluginSettings, 'debugLog' | 'defaultReplaceVisible' | 'includeCodeBlock' | 'minimapVisible' | 'optimizeLargeCodeBlocks' | 'preloadSelection' | 'rememberPanelPosition' | 'searchAttributeView'>
