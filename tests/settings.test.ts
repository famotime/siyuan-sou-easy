import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  createSearchOptionsFromSettings,
  normalizeSettings,
} from '@/settings'

describe('normalizeSettings', () => {
  it('keeps search-related booleans when provided', () => {
    const settings = normalizeSettings({
      debugLog: true,
      includeCodeBlock: true,
      preserveCase: true,
    })

    expect(settings).toMatchObject({
      debugLog: true,
      includeCodeBlock: true,
      preserveCase: true,
    })
  })

  it('falls back to defaults for search-related booleans', () => {
    const settings = normalizeSettings({})

    expect(settings).toMatchObject({
      debugLog: DEFAULT_SETTINGS.debugLog,
      includeCodeBlock: DEFAULT_SETTINGS.includeCodeBlock,
      preserveCase: DEFAULT_SETTINGS.preserveCase,
    })
  })
})

describe('createSearchOptionsFromSettings', () => {
  it('uses includeCodeBlock as the default search option', () => {
    const options = createSearchOptionsFromSettings(normalizeSettings({
      includeCodeBlock: true,
    }))

    expect(options).toEqual({
      includeCodeBlock: true,
      matchCase: false,
      useRegex: false,
      wholeWord: false,
    })
  })
})
