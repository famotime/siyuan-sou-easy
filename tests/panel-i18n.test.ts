// @vitest-environment jsdom

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  createApp,
  nextTick,
} from 'vue'

import App from '@/App.vue'
import {
  applyPluginSettings,
  closePanel,
  openPanel,
  searchReplaceState,
} from '@/features/search-replace/store'
import { setPluginInstance } from '@/plugin-instance'
import {
  DEFAULT_SETTINGS,
  createSearchOptionsFromSettings,
} from '@/settings'

describe('search panel i18n', () => {
  let host: HTMLDivElement | null = null
  let app: ReturnType<typeof createApp> | null = null

  beforeEach(() => {
    resetState()
    setPluginInstance({
      i18n: {
        closePanel: 'Close',
        currentDocumentLabel: 'Current document',
        findPlaceholder: 'Find',
        matchCase: 'Match case',
        matchCounter: '{current} / {total}',
        navigationPending: 'Locating the current match. Content is still loading and the panel will scroll to it automatically.',
        nextMatch: 'Next match',
        previousMatch: 'Previous match',
        regexHelpDescAlternation: 'matches either install or deploy',
        regexHelpDescVersion: 'matches versions like v1.2.3',
        regexHelpDescWhitespace: 'matches install and plugin with whitespace between them',
        regexHelpNote: 'Regex search is supported. Replacement text is still inserted literally, so backreferences like $1 and \\1 are not supported yet.',
        regexHelpPatternAlternation: 'install|deploy',
        regexHelpPatternVersion: 'v\\d+\\.\\d+\\.\\d+',
        regexHelpPatternWhitespace: 'install\\s+plugin',
        regexHelpTitle: 'Regex search help',
        replaceAction: 'Replace',
        replaceAllAction: 'Replace all',
        replaceCurrentUnsupported: 'The current match spans complex formatting and cannot be replaced directly yet.',
        replacePlaceholder: 'Replace',
        replaceToggle: 'Expand or collapse replace row',
        selectionOnly: 'Find and replace within selection only',
        skipAction: 'Skip',
        useRegex: 'Use regex',
        wholeWord: 'Match whole word',
      },
    } as any)
  })

  afterEach(() => {
    app?.unmount()
    host?.remove()
    closePanel()
    setPluginInstance(null)
    host = null
    app = null
  })

  it('renders the panel in English when the plugin locale is English', async () => {
    mountPanel()
    applyPluginSettings({ ...DEFAULT_SETTINGS })
    searchReplaceState.currentTitle = 'Daily Notes'
    searchReplaceState.query = 'foo'
    searchReplaceState.matches = [{
      blockId: 'block-1',
      blockIndex: 0,
      blockType: 'NodeParagraph',
      end: 3,
      id: 'block-1:0:3',
      matchedText: 'foo',
      previewText: 'foo [bar]',
      replaceable: false,
      rootId: 'root-1',
      start: 0,
    }]
    searchReplaceState.navigationHint = 'Locating the current match. Content is still loading and the panel will scroll to it automatically.'
    searchReplaceState.options.useRegex = true
    openPanel(true, true)
    await nextTick()

    expect(host?.querySelector('input[placeholder="Find"]')).not.toBeNull()
    expect(host?.querySelector('input[placeholder="Replace"]')).not.toBeNull()
    expect(host?.querySelector('button[title="Match case"]')).not.toBeNull()
    expect(host?.querySelector('button[title="Match whole word"]')).not.toBeNull()
    expect(host?.querySelector('button[title="Use regex"]')).not.toBeNull()
    expect(host?.querySelector('button[title="Find and replace within selection only"]')).not.toBeNull()
    expect(host?.querySelector('button[title="Previous match"]')).not.toBeNull()
    expect(host?.querySelector('button[title="Next match"]')).not.toBeNull()
    expect(host?.querySelector('button[title="Close"]')).not.toBeNull()
    expect(host?.querySelector('.sfsr-count')?.textContent?.trim()).toBe('1 / 1')
    expect(host?.textContent).toContain('Replace')
    expect(host?.textContent).toContain('Skip')
    expect(host?.textContent).toContain('Replace all')
    expect(host?.textContent).toContain('Regex search help')
    expect(host?.textContent).toContain('install|deploy')
    expect(host?.textContent).not.toContain('Daily Notes')
    expect(host?.textContent).not.toContain('Current document:')
    expect(host?.textContent).toContain('Locating the current match. Content is still loading and the panel will scroll to it automatically.')
    expect(host?.textContent).toContain('The current match spans complex formatting and cannot be replaced directly yet.')
  })

  function mountPanel() {
    host = document.createElement('div')
    document.body.appendChild(host)
    app = createApp(App)
    app.mount(host)
  }

  function resetState() {
    searchReplaceState.visible = false
    searchReplaceState.replaceVisible = DEFAULT_SETTINGS.defaultReplaceVisible
    searchReplaceState.minimapVisible = false
    searchReplaceState.preserveCase = false
    searchReplaceState.panelPosition = null
    searchReplaceState.query = ''
    searchReplaceState.replacement = ''
    searchReplaceState.options = createSearchOptionsFromSettings(DEFAULT_SETTINGS)
    searchReplaceState.currentRootId = ''
    searchReplaceState.currentTitle = ''
    searchReplaceState.navigationHint = ''
    searchReplaceState.matches = []
    searchReplaceState.currentIndex = 0
    searchReplaceState.error = ''
    searchReplaceState.busy = false
    searchReplaceState.minimapBlocks = []
    searchReplaceState.searchableBlockCount = 0
  }
})
