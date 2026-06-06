export interface TerminalSearchOptions {
  matchCase?: boolean
  query: string
  useRegex?: boolean
  wholeWord?: boolean
}

export interface TerminalSearchMatch {
  col: number
  id: string
  length: number
  matchedText: string
  previewText: string
  row: number
}

export interface TerminalSearchResult {
  currentIndex: number
  error: string
  matches: TerminalSearchMatch[]
}

export interface TerminalSearchSurface {
  clear: () => void
  focus: () => void
  goTo: (index: number) => void
  id: string
  search: (options: TerminalSearchOptions) => TerminalSearchResult
  title: string
}

export interface TerminalSearchRegistry {
  getActiveSurface: () => TerminalSearchSurface | null
  listSurfaces: () => TerminalSearchSurface[]
  subscribe: (listener: () => void) => () => void
  version: 1
}

declare global {
  interface Window {
    __SIYUAN_TERMINAL_SEARCH__?: TerminalSearchRegistry
  }
}

export function getTerminalSearchRegistry(targetWindow: Window = window): TerminalSearchRegistry | null {
  const registry = targetWindow.__SIYUAN_TERMINAL_SEARCH__
  return registry?.version === 1 ? registry : null
}

export function getActiveTerminalSearchSurface(): TerminalSearchSurface | null {
  return getTerminalSearchRegistry()?.getActiveSurface() ?? null
}

export function isTerminalSearchTarget(target: EventTarget | Element | null): boolean {
  return target instanceof Element && Boolean(target.closest('.ai-term-terminal, .ai-term-tab-container'))
}
