import type { Ref } from 'vue'
import type {
  DiffDocumentGroup,
  DiffItem,
  DiffSummary,
} from '../diff-builder'
import {
  computed,
  ref,
} from 'vue'
import {
  buildVisualDiff,
  recalculateDiffSummary,
} from '../diff-builder'
import { executeBatchReplace } from '../replace-engine'
import {
  executeGlobalSearch,
  globalSearchState,
} from '../store'

// 拆分自 GlobalSearchDockView.vue（RF-107）：批量替换 Diff 弹窗的编排逻辑
// （构建预览、切换排除、执行替换）。diffModalRef 由组件传入以驱动进度回调。

export interface BatchReplaceDiffDeps {
  /** 仅单词（非多词）查询才允许批量替换 */
  singleKeywordForReplace: Ref<string>
  canBatchReplace: Ref<boolean>
}

export function useBatchReplaceDiff(deps: BatchReplaceDiffDeps) {
  const showDiffModal = ref(false)
  const executing = ref(false)
  const progress = ref({
    processed: 0,
    total: 0,
  })

  const currentDiffSummary = ref<DiffSummary>({
    totalCount: 0,
    includedCount: 0,
    excludedCount: 0,
    affectedDocCount: 0,
    groups: [],
  })

  function openBatchReplaceDiff() {
    if (!deps.canBatchReplace.value) {
      return
    }
    const summary = buildVisualDiff(globalSearchState.results, globalSearchState.replacement, {
      query: deps.singleKeywordForReplace.value,
      useRegex: globalSearchState.options.useRegex,
      matchCase: globalSearchState.options.matchCase,
      wholeWord: globalSearchState.options.wholeWord,
    })
    currentDiffSummary.value = summary
    // 打开新弹窗时归零进度，避免上次替换的进度残留（本次未触发进度回调时尤为明显）
    progress.value = {
      processed: 0,
      total: 0,
    }
    showDiffModal.value = true
  }

  function closeDiffModal() {
    showDiffModal.value = false
  }

  function onToggleDiffItem(item: DiffItem) {
    item.excluded = !item.excluded
    recalculateDiffSummary(currentDiffSummary.value)
  }

  function onToggleDiffGroup(group: DiffDocumentGroup) {
    const targetExcluded = !group.allExcluded
    for (const item of group.items) {
      item.excluded = targetExcluded
    }
    recalculateDiffSummary(currentDiffSummary.value)
  }

  function onToggleDiffAll(included: boolean) {
    for (const group of currentDiffSummary.value.groups) {
      for (const item of group.items) {
        item.excluded = !included
      }
    }
    recalculateDiffSummary(currentDiffSummary.value)
  }

  async function onConfirmExecuteReplace() {
    executing.value = true
    try {
      const result = await executeBatchReplace(
        currentDiffSummary.value,
        globalSearchState.query,
        globalSearchState.replacement,
        (processed, total) => {
          progress.value = {
            processed,
            total,
          }
        },
      )
      if (result.success) {
        showDiffModal.value = false
        await executeGlobalSearch()
      }
    } finally {
      executing.value = false
    }
  }

  return {
    closeDiffModal,
    currentDiffSummary,
    executing,
    onConfirmExecuteReplace,
    onToggleDiffAll,
    onToggleDiffGroup,
    onToggleDiffItem,
    openBatchReplaceDiff,
    progress,
    showDiffModal,
  }
}

export function useCanBatchReplace(parsedCurrentQuery: Ref<{ isMultiTermQuery: boolean, singleKeyword?: string }>) {
  return computed(() => {
    return (
      globalSearchState.query.trim().length > 0
      && globalSearchState.results.length > 0
      && !globalSearchState.searching
      && !parsedCurrentQuery.value.isMultiTermQuery
    )
  })
}
