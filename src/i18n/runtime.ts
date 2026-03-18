import enUS from './en_US.json'
import zhCN from './zh_CN.json'
import { getPluginInstance } from '@/plugin-instance'

type Messages = typeof zhCN
export type I18nKey = keyof Messages

function resolveMessage(key: I18nKey) {
  const pluginMessage = getPluginInstance()?.i18n?.[key as string]
  if (typeof pluginMessage === 'string' && pluginMessage.trim()) {
    return pluginMessage
  }

  return zhCN[key] ?? enUS[key] ?? key
}

export function t(key: I18nKey, params: Record<string, number | string> = {}) {
  let message = resolveMessage(key)

  Object.entries(params).forEach(([name, value]) => {
    message = message.replaceAll(`{${name}}`, String(value))
  })

  return message
}
