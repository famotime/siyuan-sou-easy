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
  /** VisualDiffModal 的模板 ref，用于 setExecuting/setProgress */
  diffModalRef: Ref<{ setExecuting: (v: boolean) => void, setProgress: (processed: number, total: number) => void } | undefined>
}

export function useBatchReplaceDiff(deps: BatchReplaceDiffDeps) {
  const showDiffModal = ref(false)

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
    deps.diffModalRef.value?.setExecuting(true)
    try {
      const result = await executeBatchReplace(
        currentDiffSummary.value,
        globalSearchState.query,
        globalSearchState.replacement,
        (processed, total) => {
          deps.diffModalRef.value?.setProgress(processed, total)
        },
      )
      if (result.success) {
        showDiffModal.value = false
        await executeGlobalSearch()
      }
    } finally {
      deps.diffModalRef.value?.setExecuting(false)
    }
  }

  return {
    closeDiffModal,
    currentDiffSummary,
    onConfirmExecuteReplace,
    onToggleDiffAll,
    onToggleDiffGroup,
    onToggleDiffItem,
    openBatchReplaceDiff,
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
