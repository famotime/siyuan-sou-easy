import type { IOperation } from 'siyuan'
import type {
  EditorContext,
  SearchMatch,
} from '../types'
import type { SearchReplaceState } from './state'
import {

  showMessage,
} from 'siyuan'
import { t } from '@/i18n/runtime'
import { replaceCanvasMatchGroups } from '../canvas/replacement'
import { debugLog } from '../debug'
import {
  hasAttributeViewMatches,
  hasCanvasMatches,
  hasUnsupportedCanvasReplacementMatches,
  isAttributeViewMatch,
  isCanvasMatch,
} from '../match-utils'

interface ReplaceDependenciesBase {
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

interface ReplaceCurrentDependencies extends ReplaceDependenciesBase {
  getCurrentMatch: () => SearchMatch | null
  revealCurrentMatch: (context?: EditorContext, scrollMode?: 'if-needed' | 'none') => void
}

/**
 * busy 互斥执行器：在发起任何异步操作之前同步占用 busy 标志。
 * 若先做异步准备再上锁，两次快速触发都会通过入口检查并发执行（TOCTOU）。
 */
async function withBusyExclusive<T>(state: SearchReplaceState, action: () => Promise<T>): Promise<T | undefined> {
  if (state.busy) {
    return undefined
  }

  state.busy = true
  try {
    return await action()
  } finally {
    state.busy = false
  }
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
  if (!match || state.busy || state.documentReadonly) {
    return
  }

  await withBusyExclusive(state, async () => {
    if (isAttributeViewMatch(match)) {
      showMessage(t('replaceAttributeViewUnsupported'), 4000, 'error')
      return
    }
    if (isCanvasMatch(match)) {
      if (!match.replaceable) {
        showMessage(t('replaceCanvasNoteUnsupported'), 4000, 'error')
        return
      }

      const result = await replaceCanvasMatchGroups({
        getReplacementText: () => state.replacement,
        matches: [match],
        preserveCase: state.preserveCase,
      })
      await refreshMatches()
      if (state.matches.length > 0) {
        revealCurrentMatch(undefined, 'if-needed')
      }
      showMessage(t('replaceAllResult', result), 3000, 'info')
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
    const canUseTransaction = context.protyleRef && !context.protyleRef.disabled
    if (canUseTransaction) {
      const doOperations: IOperation[] = [{
        action: 'update',
        id: match.blockId,
        data: outcome.clone.outerHTML,
      }]
      const undoOperations: IOperation[] = [{
        action: 'update',
        id: match.blockId,
        data: blockElement.outerHTML,
      }]
      try {
        const protyleInstance = context.protyleRef!.getInstance?.()
        if (protyleInstance) {
          protyleInstance.transaction(doOperations, undoOperations)
        } else {
          console.warn('[search-replace] protyle instance not found, fallback to updateDomBlock')
          await updateDomBlock(match.blockId, outcome.clone.outerHTML)
        }
      } catch (e) {
        console.warn('[search-replace] protyle transaction failed, fallback to updateDomBlock', e)
        await updateDomBlock(match.blockId, outcome.clone.outerHTML)
      }
    } else {
      await updateDomBlock(match.blockId, outcome.clone.outerHTML)
    }

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
  })
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
}: ReplaceDependenciesBase) {
  if (!state.matches.length || state.busy || state.documentReadonly) {
    return
  }

  await withBusyExclusive(state, async () => {
    if (hasAttributeViewMatches(state.matches)) {
      showMessage(t('replaceAttributeViewUnsupported'), 4000, 'error')
      return
    }
    if (hasUnsupportedCanvasReplacementMatches(state.matches)) {
      showMessage(t('replaceCanvasNoteUnsupported'), 4000, 'error')
      return
    }
    if (hasCanvasMatches(state.matches)) {
      const confirmed = window.confirm(t('replaceAllConfirm', { count: state.matches.length }))
      if (!confirmed) {
        return
      }

      const result = await replaceCanvasMatchGroups({
        getReplacementText: () => state.replacement,
        matches: state.matches,
        preserveCase: state.preserveCase,
      })
      await refreshMatches()
      showMessage(t('replaceAllResult', result), 4000, 'info')
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
    // 事务路径的替换数延迟到事务提交后再计入：
    // 提交失败时这些块实际未变更，若提前计数会出现"替换成功 N 处"的假成功提示
    let preparedReplacedCount = 0
    let preparedSkippedCount = 0

    const missingBlockIds = Array.from(groupedMatches.keys()).filter((blockId) => !getBlockElement(context, blockId))
    const fallbackDoms = missingBlockIds.length
      ? await getBlockDoms(missingBlockIds)
      : {}

    const canUseTransaction = context.protyleRef && !context.protyleRef.disabled
    const doOperations: IOperation[] = []
    const undoOperations: IOperation[] = []

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

      if (canUseTransaction) {
        doOperations.push({
          action: 'update',
          id: blockId,
          data: outcome.clone.outerHTML,
        })
        undoOperations.push({
          action: 'update',
          id: blockId,
          data: blockElement.outerHTML,
        })
        preparedReplacedCount += outcome.appliedCount
        preparedSkippedCount += Math.max(0, matches.length - outcome.appliedCount)
      } else {
        await updateDomBlock(blockId, outcome.clone.outerHTML)
        replacedCount += outcome.appliedCount
        skippedCount += Math.max(0, matches.length - outcome.appliedCount)
      }
    }

    if (canUseTransaction && doOperations.length > 0) {
      let committed = false
      try {
        const protyleInstance = context.protyleRef!.getInstance?.()
        if (protyleInstance) {
          protyleInstance.transaction(doOperations, undoOperations)
          committed = true
        } else {
          console.warn('[search-replace] protyle instance not found for batch replacement')
        }
      } catch (e) {
        console.warn('[search-replace] protyle transaction failed', e)
        // 事务失败时不再回退逐块重写：重试可能基于过期 DOM 造成二次破坏
      }

      if (committed) {
        replacedCount += preparedReplacedCount
        skippedCount += preparedSkippedCount
      } else {
        skippedCount += preparedReplacedCount + preparedSkippedCount
      }
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
    showMessage(t('replaceAllResult', {
      replacedCount,
      skippedCount,
    }), 4000, 'info')
  })
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
