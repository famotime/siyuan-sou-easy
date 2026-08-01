// @vitest-environment jsdom

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
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

describe('search panel canvas replacement controls', () => {
  let host: HTMLDivElement | null = null
  let app: ReturnType<typeof createApp> | null = null

  beforeEach(() => {
    resetState()
    setPluginInstance({
      i18n: {
        closePanel: 'Close',
        findPlaceholder: 'Find',
        matchCounter: '{current} / {total}',
        nextMatch: 'Next match',
        previousMatch: 'Previous match',
        replaceAction: 'Replace',
        replaceAllAction: 'Replace all',
        replaceCurrentUnsupported: 'The current match cannot be replaced.',
        replacePlaceholder: 'Replace',
        replaceToggle: 'Expand or collapse replace row',
        selectionOnly: 'Selection only',
        skipAction: 'Skip',
        useRegex: 'Use regex',
        wholeWord: 'Match whole word',
        matchCase: 'Match case',
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

  it('disables replace all when canvas note-file matches are search-only', async () => {
    mountPanel()
    applyPluginSettings({ ...DEFAULT_SETTINGS })
    searchReplaceState.query = 'Alpha'
    searchReplaceState.matches = [{
      blockId: 'canvas:node:f1:note',
      blockIndex: 0,
      blockType: 'CanvasNoteNode',
      canvas: {
        field: 'note',
        nodeId: 'f1',
        targetId: 'node:f1:note',
        targetType: 'node',
      },
      end: 5,
      id: 'canvas:node:f1:note:0:5',
      matchedText: 'Alpha',
      previewText: '[Alpha]',
      replaceable: false,
      rootId: 'canvas:/data/a.canvas',
      sourceKind: 'canvas',
      start: 0, occ: 0,
    }]

    openPanel(true, true)
    await nextTick()

    expect(findActionButton('Replace')?.disabled).toBe(true)
    expect(findActionButton('Replace all')?.disabled).toBe(true)
  })

  function mountPanel() {
    host = document.createElement('div')
    document.body.appendChild(host)
    app = createApp(App)
    app.mount(host)
  }

  function findActionButton(label: string) {
    return Array.from(host?.querySelectorAll<HTMLButtonElement>('.sfsr-action') ?? [])
      .find(button => button.textContent?.trim() === label)
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
    searchReplaceState.documentReadonly = false
  }
})
