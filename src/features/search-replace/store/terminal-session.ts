import type { TerminalSearchSurface } from '../terminal/registry'
import type { SearchReplaceState } from './state'
import { mapTerminalSearchResult } from '../terminal/adapter'

// 拆分自 store.ts（RF-108）：终端搜索面板的会话状态与动作。
// 终端分支此前散布在 10 个导出动作中，现收敛为单一会话对象，
// 主动作只判一次 sourceMode 再委托会话。

export interface TerminalSession {
  clearMatches: () => void
  getSurface: () => TerminalSearchSurface | null
  goTo: (index: number) => void
  handleQueryEdit: (value: string) => void
  open: (surface: TerminalSearchSurface, replaceVisible?: boolean) => void
  refresh: () => boolean
  reset: () => void
  step: (delta: number) => void
  toggleOption: (option: keyof SearchReplaceState['options']) => void
}

/**
 * 终端面板打开时的状态赋值（对齐 applyOpenPanelState 的纯函数模式）。
 */
export function applyTerminalPanelState(
  state: SearchReplaceState,
  surface: TerminalSearchSurface,
  replaceVisible?: boolean,
) {
  state.sourceMode = 'terminal'
  state.terminalSurfaceId = surface.id
  state.currentRootId = surface.id
  state.currentTitle = surface.title
  state.documentReadonly = true
  state.options.selectionOnly = false
  state.visible = true
  state.replaceVisible = Boolean(replaceVisible)
  state.error = ''
  state.navigationHint = ''
  state.matches = []
  state.currentIndex = 0
  state.searchableBlockCount = 0
  state.minimapBlocks = []
}

export function createTerminalSession(state: SearchReplaceState): TerminalSession {
  let activeTerminalSurface: TerminalSearchSurface | null = null

  // 终端模式下清空匹配结果的三连赋值（原在 3 处逐字重复）
  function clearMatches() {
    state.matches = []
    state.currentIndex = 0
    state.error = ''
  }

  function refresh() {
    if (!activeTerminalSurface || state.sourceMode !== 'terminal') {
      return false
    }

    const result = activeTerminalSurface.search({
      matchCase: state.options.matchCase,
      query: state.query,
      useRegex: state.options.useRegex,
      wholeWord: state.options.wholeWord,
    })
    const mapped = mapTerminalSearchResult(result, activeTerminalSurface.id)
    state.matches = mapped.matches
    state.currentIndex = mapped.matches.length ? Math.max(0, mapped.currentIndex) : 0
    state.error = mapped.error
    state.searchableBlockCount = mapped.matches.length ? 1 : 0
    state.minimapBlocks = []
    return true
  }

  function reset() {
    const wasTerminalMode = state.sourceMode === 'terminal' || Boolean(activeTerminalSurface)
    activeTerminalSurface?.clear()
    activeTerminalSurface = null
    state.sourceMode = 'editor'
    state.terminalSurfaceId = undefined
    if (wasTerminalMode) {
      state.documentReadonly = false
    }
  }

  function open(surface: TerminalSearchSurface, replaceVisible?: boolean) {
    activeTerminalSurface = surface
    applyTerminalPanelState(state, surface, replaceVisible)
    surface.focus()
    if (state.query.trim()) {
      if (state.settings.searchOnEnter) {
        if (state.committedQuery && state.query === state.committedQuery) {
          refresh()
        }
      } else {
        refresh()
      }
    }
  }

  function step(delta: number) {
    if (!state.matches.length) {
      return
    }
    state.currentIndex = (state.currentIndex + delta + state.matches.length) % state.matches.length
    activeTerminalSurface?.goTo(state.currentIndex)
  }

  function goTo(index: number) {
    state.currentIndex = index
    activeTerminalSurface?.goTo(state.currentIndex)
  }

  function handleQueryEdit(value: string) {
    state.query = value
    if (state.settings.searchOnEnter) {
      if (value !== state.committedQuery) {
        clearMatches()
      }
      return
    }
    refresh()
  }

  function toggleOption(option: keyof SearchReplaceState['options']) {
    if (option === 'selectionOnly') {
      state.options.selectionOnly = false
      return
    }
    state.options[option] = !state.options[option]
    if (state.settings.searchOnEnter) {
      if (state.committedQuery && state.query === state.committedQuery) {
        refresh()
      }
      return
    }
    refresh()
  }

  return {
    clearMatches,
    getSurface: () => activeTerminalSurface,
    goTo,
    handleQueryEdit,
    open,
    refresh,
    reset,
    step,
    toggleOption,
  }
}
