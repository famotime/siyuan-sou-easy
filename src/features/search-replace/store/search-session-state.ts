export function resolveNextPanelVisibility(currentVisible: boolean, forceVisible?: boolean) {
  return forceVisible ?? !currentVisible
}

export function applyOpenPanelState(
  state: {
    replaceVisible: boolean
    settings: {
      defaultReplaceVisible: boolean
    }
  },
  replaceVisible?: boolean,
) {
  state.replaceVisible = typeof replaceVisible === 'boolean'
    ? replaceVisible
    : state.settings.defaultReplaceVisible
}

export function applyClosePanelState(
  state: {
    busy: boolean
    documentReadonly: boolean
    error: string
    minimapBlocks: unknown[]
    navigationHint: string
    searchableBlockCount: number
    searching: boolean
    visible: boolean
  },
) {
  state.visible = false
  state.busy = false
  state.searching = false
  state.documentReadonly = false
  state.error = ''
  state.navigationHint = ''
  state.minimapBlocks = []
  state.searchableBlockCount = 0
}

export function clearQueryEditState(
  state: {
    currentIndex: number
    error: string
    matches: unknown[]
    minimapBlocks: unknown[]
    navigationHint: string
    query: string
    searchableBlockCount: number
    searching: boolean
  },
) {
  const pendingQueryIndex = state.matches.length ? state.currentIndex : 0
  state.searching = false
  state.navigationHint = ''
  state.error = ''
  state.matches = []
  state.minimapBlocks = []
  state.searchableBlockCount = 0

  if (!state.query.trim()) {
    state.currentIndex = 0
    return null
  }

  return pendingQueryIndex
}
