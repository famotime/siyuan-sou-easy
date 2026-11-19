import {
  getFrontend,
  openMobileFileById,
  openTab,
  type TProtyleAction,
} from 'siyuan'
import { getPluginInstance } from '@/plugin-instance'
import type { SearchMatch } from './types'

const NATIVE_NAVIGATION_ACTIONS: TProtyleAction[] = [
  'cb-get-html',
  'cb-get-hl',
  'cb-get-focus',
  'cb-get-unchangeid',
  'cb-get-before',
  'cb-get-append',
]

type NativeMatchNavigationResult = 'failed' | 'triggered' | 'unsupported'

export function canTriggerNativeMatchNavigation(match: SearchMatch) {
  // 仅允许真实 protyle 块触发原生导航：attribute-view / canvas / terminal 的
  // blockId 都是合成 id（如 "canvas:xxx"、"surfaceId:row"），传入 openTab
  // 会打开不存在的文档，配合 removeCurrentTab 还会移除当前页签
  if (match.sourceKind && match.sourceKind !== 'block') {
    return false
  }

  const plugin = getPluginInstance()
  if (!plugin?.app || !match.blockId.trim()) {
    return false
  }

  return true
}

export async function triggerNativeMatchNavigation(match: SearchMatch): Promise<NativeMatchNavigationResult> {
  if (!canTriggerNativeMatchNavigation(match)) {
    return 'unsupported'
  }

  const plugin = getPluginInstance()!

  const action = NATIVE_NAVIGATION_ACTIONS
  const frontend = getFrontend()

  try {
    if (frontend === 'mobile' || frontend === 'browser-mobile') {
      openMobileFileById(plugin.app, match.blockId, action)
      return 'triggered'
    }

    await openTab({
      app: plugin.app,
      doc: {
        action,
        id: match.blockId,
      },
      openNewTab: false,
      removeCurrentTab: true,
    })
    return 'triggered'
  } catch {
    return 'failed'
  }
}
