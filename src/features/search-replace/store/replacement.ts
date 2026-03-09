import { showMessage } from 'siyuan'
import { debugLog } from '../debug'
import type {
  EditorContext,
  SearchMatch,
} from '../types'
import type { SearchReplaceState } from './state'

interface ReplaceCurrentDependencies {
  applyReplacementsToClone: typeof import('../editor').applyReplacementsToClone
  clearSelectionScope: (rootId?: string) => void
  getBlockElement: typeof import('../editor').getBlockElement
  getCurrentMatch: () => SearchMatch | null
  refreshMatches: () => Promise<void>
  resolveEditorContext: () => EditorContext | null
  revealCurrentMatch: (context?: EditorContext, scrollMode?: 'if-needed' | 'none') => void
  state: SearchReplaceState
  updateDomBlock: typeof import('../kernel').updateDomBlock
}

interface ReplaceAllDependencies {
  applyReplacementsToClone: typeof import('../editor').applyReplacementsToClone
  clearSelectionScope: (rootId?: string) => void
  getBlockElement: typeof import('../editor').getBlockElement
  refreshMatches: () => Promise<void>
  resolveEditorContext: () => EditorContext | null
  state: SearchReplaceState
  updateDomBlock: typeof import('../kernel').updateDomBlock
}

export async function replaceCurrentMatch({
  applyReplacementsToClone,
  clearSelectionScope,
  getBlockElement,
  getCurrentMatch,
  refreshMatches,
  resolveEditorContext,
  revealCurrentMatch,
  state,
  updateDomBlock,
}: ReplaceCurrentDependencies) {
  const match = getCurrentMatch()
  if (!match || state.busy) {
    return
  }

  debugLog('replace-current:start', match)

  const context = resolveEditorContext()
  if (!context || context.rootId !== match.rootId) {
    await refreshMatches()
    return
  }

  const blockElement = getBlockElement(context, match.blockId)
  if (!blockElement) {
    await refreshMatches()
    return
  }

  const outcome = applyReplacementsToClone(blockElement, [match], state.replacement, {
    preserveCase: state.settings.preserveCase,
  })
  if (!outcome.clone || outcome.appliedCount === 0) {
    showMessage('当前命中跨越复杂格式，暂不支持直接替换', 4000, 'error')
    return
  }

  const nextIndex = state.currentIndex

  try {
    state.busy = true
    await updateDomBlock(match.blockId, outcome.clone.outerHTML)
    if (state.options.selectionOnly) {
      clearSelectionScope(match.rootId)
    }
    await refreshMatches()
    if (state.matches.length > 0) {
      state.currentIndex = Math.min(nextIndex, state.matches.length - 1)
      revealCurrentMatch(undefined, 'if-needed')
    }
    debugLog('replace-current:done', {
      blockId: match.blockId,
      nextIndex: state.currentIndex,
    })
    showMessage('已替换当前命中', 2000, 'info')
  } finally {
    state.busy = false
  }
}

export async function replaceAllMatches({
  applyReplacementsToClone,
  clearSelectionScope,
  getBlockElement,
  refreshMatches,
  resolveEditorContext,
  state,
  updateDomBlock,
}: ReplaceAllDependencies) {
  if (!state.matches.length || state.busy) {
    return
  }

  debugLog('replace-all:start', {
    count: state.matches.length,
  })

  const confirmed = window.confirm(`确定替换当前文档内的 ${state.matches.length} 处命中吗？`)
  if (!confirmed) {
    return
  }

  const context = resolveEditorContext()
  if (!context) {
    state.error = '未找到当前文档'
    return
  }

  const groupedMatches = new Map<string, SearchMatch[]>()
  state.matches.forEach((match) => {
    if (match.rootId !== context.rootId) {
      return
    }

    const group = groupedMatches.get(match.blockId) ?? []
    group.push(match)
    groupedMatches.set(match.blockId, group)
  })

  let replacedCount = 0
  let skippedCount = 0

  try {
    state.busy = true

    for (const [blockId, matches] of groupedMatches) {
      const blockElement = getBlockElement(context, blockId)
      if (!blockElement) {
        skippedCount += matches.length
        continue
      }

      const outcome = applyReplacementsToClone(blockElement, matches, state.replacement, {
        preserveCase: state.settings.preserveCase,
      })
      if (!outcome.clone || outcome.appliedCount === 0) {
        skippedCount += matches.length
        continue
      }

      await updateDomBlock(blockId, outcome.clone.outerHTML)
      replacedCount += outcome.appliedCount
      skippedCount += Math.max(0, matches.length - outcome.appliedCount)
    }

    if (replacedCount > 0 && state.options.selectionOnly) {
      clearSelectionScope(context.rootId)
    }
    await refreshMatches()
    debugLog('replace-all:done', {
      replacedCount,
      skippedCount,
    })
    showMessage(`替换完成：${replacedCount} 处，跳过 ${skippedCount} 处`, 4000, 'info')
  } finally {
    state.busy = false
  }
}
