import type { Setting } from 'siyuan'
import {
  BOOLEAN_SETTING_DEFINITIONS,
  COLOR_SETTING_DEFINITIONS,
  HOTKEY_SETTING_DEFINITIONS,
  NUMBER_SETTING_DEFINITIONS,
  type ColorSettingKey,
  type HotkeySettingKey,
  type NumberSettingKey,
} from './settings-panel'
import { DEFAULT_SEARCH_HIGHLIGHT_COLOR, type PluginSettings } from '@/settings'

const NESTED_SETTING_INDENT = '\u00a0\u00a0\u00a0\u00a0'

export function registerSearchReplaceSettings({
  createCheckbox,
  createColorSetting,
  createHotkeyInput,
  createNumberInput,
  i18n,
  onBooleanChange,
  onColorChange,
  onHotkeyChange,
  onNumberChange,
  setting,
  settings,
}: {
  createCheckbox: (checked: boolean, onChange: (checked: boolean) => Promise<void>) => HTMLInputElement
  createColorSetting: (value: string, onChange: (value: string) => Promise<boolean>) => HTMLElement
  createHotkeyInput: (value: string, onChange: (value: string) => Promise<boolean>) => HTMLInputElement
  createNumberInput: (value: number, onChange: (value: number) => Promise<boolean>) => HTMLInputElement
  i18n: Record<string, string>
  onBooleanChange: <TKey extends BooleanSettingKey>(settingKey: TKey, checked: boolean) => Promise<void>
  onColorChange: (settingKey: ColorSettingKey, value: string) => Promise<boolean>
  onHotkeyChange: (settingKey: HotkeySettingKey, value: string) => Promise<boolean>
  onNumberChange: (settingKey: NumberSettingKey, value: number) => Promise<boolean>
  setting: Setting
  settings: PluginSettings
}) {
  let includeCodeBlockEnabled = settings.includeCodeBlock
  const includeCodeBlockDependentInputs: HTMLInputElement[] = []

  const syncIncludeCodeBlockDependentInputs = () => {
    const disabled = !includeCodeBlockEnabled
    includeCodeBlockDependentInputs.forEach((input) => {
      input.disabled = disabled
    })
  }

  const registerIncludeCodeBlockDependentInput = (input: HTMLInputElement) => {
    includeCodeBlockDependentInputs.push(input)
    syncIncludeCodeBlockDependentInputs()
    return input
  }

  const formatNestedSettingText = (text: string) => `${NESTED_SETTING_INDENT}${text}`

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
    const isIncludeCodeBlockSetting = settingKey === 'includeCodeBlock'
    const isNestedCodeBlockSetting = settingKey === 'optimizeLargeCodeBlocks'
    setting.addItem({
      title: isNestedCodeBlockSetting ? formatNestedSettingText(i18n[titleKey]) : i18n[titleKey],
      description: isNestedCodeBlockSetting ? formatNestedSettingText(i18n[descriptionKey]) : i18n[descriptionKey],
      createActionElement: () => {
        const input = createCheckbox(settings[settingKey], async (checked) => {
          await onBooleanChange(settingKey, checked)
          if (!isIncludeCodeBlockSetting) {
            return
          }

          includeCodeBlockEnabled = checked
          syncIncludeCodeBlockDependentInputs()
        })
        if (!isNestedCodeBlockSetting) {
          return input
        }

        return registerIncludeCodeBlockDependentInput(input)
      },
    })

    if (settingKey !== 'optimizeLargeCodeBlocks') {
      return
    }

    NUMBER_SETTING_DEFINITIONS.forEach(({ descriptionKey, settingKey, titleKey }) => {
      setting.addItem({
        title: formatNestedSettingText(i18n[titleKey]),
        description: formatNestedSettingText(i18n[descriptionKey]),
        createActionElement: () => {
          const input = createNumberInput(settings[settingKey], async (value) => {
            return await onNumberChange(settingKey, value)
          })
          return registerIncludeCodeBlockDependentInput(input)
        },
      })
    })
  })

  COLOR_SETTING_DEFINITIONS.forEach(({ descriptionKey, settingKey, titleKey }) => {
    setting.addItem({
      title: i18n[titleKey],
      description: i18n[descriptionKey],
      createActionElement: () => createColorSetting(settings[settingKey], async (value) => {
        return await onColorChange(settingKey, value || DEFAULT_SEARCH_HIGHLIGHT_COLOR)
      }),
    })
  })
}

type BooleanSettingKey = Extract<keyof PluginSettings, 'debugLog' | 'defaultReplaceVisible' | 'includeCodeBlock' | 'minimapVisible' | 'optimizeLargeCodeBlocks' | 'preloadSelection' | 'rememberPanelPosition' | 'searchAttributeView'>
