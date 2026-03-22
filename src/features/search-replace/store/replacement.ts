import { showMessage } from 'siyuan'
import { debugLog } from '../debug'
import { hasAttributeViewMatches, isAttributeViewMatch } from '../match-utils'
import type {
  EditorContext,
  SearchMatch,
} from '../types'
import { t } from '@/i18n/runtime'
import type { SearchReplaceState } from './state'

interface ReplaceCurrentDependencies {
  applyReplacementsToClone: typeof import('../editor').applyReplacementsToClone
  clearSelectionScope: (rootId?: string) => void
  createBlockElementFromDom: typeof import('../editor').createBlockElementFromDom
  getBlockDoms: typeof import('../kernel').getBlockDoms
  getBlockElement: typeof import('../editor').getBlockElement
  getCurrentMatch: () => SearchMatch | null
  invalidateDocumentSnapshot: (rootId?: string) => void
  refreshMatches: () => Promise<void>
  resolveEditorContext: () => EditorContext | null
  revealCurrentMatch: (context?: EditorContext, scrollMode?: 'if-needed' | 'none') => void
  state: SearchReplaceState
  updateDomBlock: typeof import('../kernel').updateDomBlock
}

interface ReplaceAllDependencies {
  applyReplacementsToClone: typeof import('../editor').applyReplacementsToClone
  clearSelectionScope: (rootId?: string) => void
  createBlockElementFromDom: typeof import('../editor').createBlockElementFromDom
  getBlockDoms: typeof import('../kernel').getBlockDoms
  getBlockElement: typeof import('../editor').getBlockElement
  invalidateDocumentSnapshot: (rootId?: string) => void
  refreshMatches: () => Promise<void>
  resolveEditorContext: () => EditorContext | null
  state: SearchReplaceState
  updateDomBlock: typeof import('../kernel').updateDomBlock
}

export async function replaceCurrentMatch({
  applyReplacementsToClone,
  clearSelectionScope,
  createBlockElementFromDom,
  getBlockDoms,
  getBlockElement,
  getCurrentMatch,
  invalidateDocumentSnapshot,
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
  if (isAttributeViewMatch(match)) {
    showMessage(t('replaceAttributeViewUnsupported'), 4000, 'error')
    return
  }

  debugLog('replace-current:start', match)

  const context = resolveEditorContext()
  if (!context || context.rootId !== match.rootId) {
    await refreshMatches()
    return
  }

  const blockElement = await resolveBlockElement({
    blockId: match.blockId,
    context,
    createBlockElementFromDom,
    getBlockDoms,
    getBlockElement,
  })
  if (!blockElement) {
    await refreshMatches()
    return
  }

  const outcome = applyReplacementsToClone(blockElement, [match], state.replacement, {
    preserveCase: state.preserveCase,
  })
  if (!outcome.clone || outcome.appliedCount === 0) {
    showMessage(t('replaceCurrentUnsupported'), 4000, 'error')
    return
  }

  const nextIndex = state.currentIndex

  try {
    state.busy = true
    await updateDomBlock(match.blockId, outcome.clone.outerHTML)
    invalidateDocumentSnapshot(match.rootId)
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
    showMessage(t('replaceCurrentDone'), 2000, 'info')
  } finally {
    state.busy = false
  }
}

export async function replaceAllMatches({
  applyReplacementsToClone,
  clearSelectionScope,
  createBlockElementFromDom,
  getBlockDoms,
  getBlockElement,
  invalidateDocumentSnapshot,
  refreshMatches,
  resolveEditorContext,
  state,
  updateDomBlock,
}: ReplaceAllDependencies) {
  if (!state.matches.length || state.busy) {
    return
  }
  if (hasAttributeViewMatches(state.matches)) {
    showMessage(t('replaceAttributeViewUnsupported'), 4000, 'error')
    return
  }

  debugLog('replace-all:start', {
    count: state.matches.length,
  })

  const confirmed = window.confirm(t('replaceAllConfirm', { count: state.matches.length }))
  if (!confirmed) {
    return
  }

  const context = resolveEditorContext()
  if (!context) {
    state.error = t('currentDocumentMissing')
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
    const missingBlockIds = Array.from(groupedMatches.keys()).filter(blockId => !getBlockElement(context, blockId))
    const fallbackDoms = missingBlockIds.length
      ? await getBlockDoms(missingBlockIds)
      : {}

    for (const [blockId, matches] of groupedMatches) {
      const blockElement = getBlockElement(context, blockId)
        ?? createBlockElementFromDom(fallbackDoms[blockId] ?? '')
      if (!blockElement) {
        skippedCount += matches.length
        continue
      }

      const outcome = applyReplacementsToClone(blockElement, matches, state.replacement, {
        preserveCase: state.preserveCase,
      })
      if (!outcome.clone || outcome.appliedCount === 0) {
        skippedCount += matches.length
        continue
      }

      await updateDomBlock(blockId, outcome.clone.outerHTML)
      replacedCount += outcome.appliedCount
      skippedCount += Math.max(0, matches.length - outcome.appliedCount)
    }

    if (replacedCount > 0) {
      invalidateDocumentSnapshot(context.rootId)
    }
    if (replacedCount > 0 && state.options.selectionOnly) {
      clearSelectionScope(context.rootId)
    }
    await refreshMatches()
    debugLog('replace-all:done', {
      replacedCount,
      skippedCount,
    })
    showMessage(t('replaceAllResult', { replacedCount, skippedCount }), 4000, 'info')
  } finally {
    state.busy = false
  }
}

async function resolveBlockElement({
  blockId,
  context,
  createBlockElementFromDom,
  getBlockDoms,
  getBlockElement,
}: {
  blockId: string
  context: EditorContext
  createBlockElementFromDom: typeof import('../editor').createBlockElementFromDom
  getBlockDoms: typeof import('../kernel').getBlockDoms
  getBlockElement: typeof import('../editor').getBlockElement
}) {
  const localElement = getBlockElement(context, blockId)
  if (localElement) {
    return localElement
  }

  const doms = await getBlockDoms([blockId])
  return createBlockElementFromDom(doms[blockId] ?? '')
}
