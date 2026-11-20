import { vi } from 'vitest'
import { searchReplaceState } from '@/features/search-replace/store'
import {
  createSearchOptionsFromSettings,
  DEFAULT_SETTINGS,
} from '@/settings'

// 拆分自原 tests/store-context.test.ts 尾部的共享工具（RF-103）。
export async function flushRefresh() {
  await vi.runOnlyPendingTimersAsync()
}

export function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })

  return {
    promise,
    resolve,
  }
}

export function resetState() {
  searchReplaceState.visible = false
  searchReplaceState.replaceVisible = DEFAULT_SETTINGS.defaultReplaceVisible
  ;(searchReplaceState as any).minimapVisible = false
  ;(searchReplaceState as any).preserveCase = false
  searchReplaceState.panelPosition = null
  searchReplaceState.settings = { ...DEFAULT_SETTINGS }
  searchReplaceState.query = ''
  searchReplaceState.replacement = ''
  searchReplaceState.options = createSearchOptionsFromSettings(DEFAULT_SETTINGS)
  searchReplaceState.currentRootId = ''
  searchReplaceState.currentTitle = ''
  searchReplaceState.documentReadonly = false
  searchReplaceState.navigationHint = ''
  searchReplaceState.minimapBlocks = []
  searchReplaceState.matches = []
  searchReplaceState.currentIndex = 0
  searchReplaceState.error = ''
  searchReplaceState.busy = false
  searchReplaceState.searchableBlockCount = 0
}
