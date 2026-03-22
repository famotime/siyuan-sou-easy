import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  DEFAULT_SETTINGS,
  createSearchOptionsFromSettings,
  loadSettings,
  normalizeSettings,
} from '@/settings'

describe('normalizeSettings', () => {
  it('keeps search-related booleans when provided', () => {
    const settings = normalizeSettings({
      debugLog: true,
      includeCodeBlock: true,
      minimapVisible: true,
      preserveCase: true,
      searchAttributeView: true,
    })

    expect(settings).toMatchObject({
      debugLog: true,
      includeCodeBlock: true,
      minimapVisible: true,
      preserveCase: true,
      searchAttributeView: true,
    })
  })

  it('falls back to defaults for search-related booleans', () => {
    const settings = normalizeSettings({})

    expect(settings).toMatchObject({
      debugLog: DEFAULT_SETTINGS.debugLog,
      includeCodeBlock: DEFAULT_SETTINGS.includeCodeBlock,
      minimapVisible: DEFAULT_SETTINGS.minimapVisible,
      preserveCase: DEFAULT_SETTINGS.preserveCase,
      searchAttributeView: DEFAULT_SETTINGS.searchAttributeView,
    })
  })
})

describe('createSearchOptionsFromSettings', () => {
  it('uses includeCodeBlock and searchAttributeView as the default search options', () => {
    const options = createSearchOptionsFromSettings(normalizeSettings({
      includeCodeBlock: true,
      searchAttributeView: true,
    }))

    expect(options).toEqual({
      includeCodeBlock: true,
      matchCase: false,
      searchAttributeView: true,
      selectionOnly: false,
      useRegex: false,
      wholeWord: false,
    })
  })
})

describe('loadSettings', () => {
  it('falls back to defaults without console warnings when stored settings cannot be read', async () => {
    const plugin = {
      loadData: async () => {
        throw new Error('boom')
      },
    }
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const settings = await loadSettings(plugin as any)

    expect(settings).toEqual(DEFAULT_SETTINGS)
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
