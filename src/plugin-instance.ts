import type { Plugin } from 'siyuan'

let pluginInstance: Plugin | null = null

export function getPluginInstance() {
  return pluginInstance
}

export function setPluginInstance(plugin: Plugin | null) {
  pluginInstance = plugin
}
