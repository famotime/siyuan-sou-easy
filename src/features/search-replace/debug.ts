let debugLoggingEnabled = false

export function setDebugLoggingEnabled(enabled: boolean) {
  debugLoggingEnabled = enabled
}

export function isDebugLoggingEnabled() {
  return debugLoggingEnabled
}

export function debugLog(...args: unknown[]) {
  if (!debugLoggingEnabled) {
    return
  }

  console.info('[sfsr]', ...args)
}
