import { reactive } from 'vue'
import {
  DEFAULT_SETTINGS,
  createSearchOptionsFromSettings,
  type PluginSettings,
} from '@/settings'
import type {
  SearchMatch,
  SearchOptions,
} from './types'

export interface PanelPosition {
  left: number
  top: number
}

export interface PersistedUiState {
  panelPosition?: PanelPosition | null
}

export const UI_STATE_STORAGE = 'ui-state.json'

export const searchReplaceState = reactive({
  visible: false,
  replaceVisible: DEFAULT_SETTINGS.defaultReplaceVisible,
  panelPosition: null as PanelPosition | null,
  settings: { ...DEFAULT_SETTINGS } as PluginSettings,
  query: '',
  replacement: '',
  options: createSearchOptionsFromSettings(DEFAULT_SETTINGS) as SearchOptions,
  currentRootId: '',
  currentTitle: '',
  matches: [] as SearchMatch[],
  currentIndex: 0,
  error: '',
  busy: false,
})

export function normalizePanelPosition(position: PanelPosition | null | undefined) {
  if (!position) {
    return null
  }

  if (!Number.isFinite(position.left) || !Number.isFinite(position.top)) {
    return null
  }

  return {
    left: position.left,
    top: position.top,
  }
}
