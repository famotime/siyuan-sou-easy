import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  debugLog,
  isDebugLoggingEnabled,
  setDebugLoggingEnabled,
} from '@/features/search-replace/debug'

describe('debug logging', () => {
  const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

  beforeEach(() => {
    setDebugLoggingEnabled(false)
    infoSpy.mockClear()
  })

  afterEach(() => {
    setDebugLoggingEnabled(false)
  })

  it('is disabled by default', () => {
    expect(isDebugLoggingEnabled()).toBe(false)
  })

  it('prints messages when enabled', () => {
    setDebugLoggingEnabled(true)

    debugLog('refresh', { count: 2 })

    expect(infoSpy).toHaveBeenCalledWith('[sfsr]', 'refresh', { count: 2 })
  })

  it('stays silent when disabled', () => {
    debugLog('replace-current')

    expect(infoSpy).not.toHaveBeenCalled()
  })
})
