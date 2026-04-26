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
      largeCodeBlockLineThreshold: 2048,
      minimapVisible: true,
      optimizeLargeCodeBlocks: true,
      preserveCase: true,
      searchHighlightColor: '#ff8800',
      searchAttributeView: true,
    })

    expect(settings).toMatchObject({
      debugLog: true,
      includeCodeBlock: true,
      largeCodeBlockLineThreshold: 2048,
      minimapVisible: true,
      optimizeLargeCodeBlocks: true,
      preserveCase: true,
      searchHighlightColor: '#ff8800',
      searchAttributeView: true,
    })
  })

  it('falls back to defaults for search-related booleans', () => {
    const settings = normalizeSettings({})

    expect(settings).toMatchObject({
      debugLog: DEFAULT_SETTINGS.debugLog,
      includeCodeBlock: DEFAULT_SETTINGS.includeCodeBlock,
      largeCodeBlockLineThreshold: DEFAULT_SETTINGS.largeCodeBlockLineThreshold,
      minimapVisible: DEFAULT_SETTINGS.minimapVisible,
      optimizeLargeCodeBlocks: DEFAULT_SETTINGS.optimizeLargeCodeBlocks,
      preserveCase: DEFAULT_SETTINGS.preserveCase,
      searchHighlightColor: DEFAULT_SETTINGS.searchHighlightColor,
      searchAttributeView: DEFAULT_SETTINGS.searchAttributeView,
    })
  })

  it('clamps invalid large code block thresholds back to the default', () => {
    expect(normalizeSettings({
      largeCodeBlockLineThreshold: 0,
    }).largeCodeBlockLineThreshold).toBe(DEFAULT_SETTINGS.largeCodeBlockLineThreshold)

    expect(normalizeSettings({
      largeCodeBlockLineThreshold: Number.NaN,
    }).largeCodeBlockLineThreshold).toBe(DEFAULT_SETTINGS.largeCodeBlockLineThreshold)
  })

  it('falls back to the default highlight color when the stored value is invalid', () => {
    expect(normalizeSettings({
      searchHighlightColor: '',
    }).searchHighlightColor).toBe(DEFAULT_SETTINGS.searchHighlightColor)

    expect(normalizeSettings({
      searchHighlightColor: 'definitely-not-a-color',
    }).searchHighlightColor).toBe(DEFAULT_SETTINGS.searchHighlightColor)
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
