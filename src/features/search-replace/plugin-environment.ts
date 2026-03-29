import { getFrontend } from 'siyuan'

export function detectPluginEnvironment() {
  const platform = getFrontend() as SyFrontendTypes
  let isElectron = false

  try {
    require('@electron/remote').require('@electron/remote/main')
    isElectron = true
  } catch {
    isElectron = false
  }

  return {
    isBrowser: platform.includes('browser'),
    isElectron,
    isInWindow: location.href.includes('window.html'),
    isLocal: location.href.includes('127.0.0.1') || location.href.includes('localhost'),
    isMobile: platform === 'mobile' || platform === 'browser-mobile',
    platform,
  }
}
