import { reactive } from 'vue'
import {
  DEFAULT_SETTINGS,
  createSearchOptionsFromSettings,
  type PluginSettings,
} from '@/settings'
import type {
  SearchMatch,
  SearchOptions,
  SearchableBlockSummary,
} from '../types'

export interface PanelPosition {
  left: number
  top: number
}

export interface PersistedUiState {
  panelPosition?: PanelPosition | null
}

export interface SearchReplaceState {
  visible: boolean
  replaceVisible: boolean
  minimapVisible: boolean
  preserveCase: boolean
  panelPosition: PanelPosition | null
  settings: PluginSettings
  query: string
  replacement: string
  options: SearchOptions
  currentRootId: string
  currentTitle: string
  navigationHint: string
  minimapBlocks: SearchableBlockSummary[]
  searchableBlockCount: number
  matches: SearchMatch[]
  currentIndex: number
  error: string
  busy: boolean
}

function createInitialSearchReplaceState(): SearchReplaceState {
  return {
    visible: false,
    replaceVisible: DEFAULT_SETTINGS.defaultReplaceVisible,
    minimapVisible: false,
    preserveCase: false,
    panelPosition: null,
    settings: { ...DEFAULT_SETTINGS },
    query: '',
    replacement: '',
    options: createSearchOptionsFromSettings(DEFAULT_SETTINGS),
    currentRootId: '',
    currentTitle: '',
    navigationHint: '',
    minimapBlocks: [],
    searchableBlockCount: 0,
    matches: [],
    currentIndex: 0,
    error: '',
    busy: false,
  }
}

export const searchReplaceState = reactive(createInitialSearchReplaceState()) as SearchReplaceState
