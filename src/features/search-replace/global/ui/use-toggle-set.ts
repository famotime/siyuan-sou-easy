import { ref } from 'vue'

// 拆分自 VisualDiffModal.vue / ReplaceHistoryTabView.vue / global store（RF-113）：
// 三处手写的「new Set 复制 → has/delete/add → 整体替换」折叠切换模式收敛于此。

export function useToggleSet(initial: ReadonlySet<string> = new Set()) {
  const selected = ref(new Set(initial))

  function has(id: string) {
    return selected.value.has(id)
  }

  function toggle(id: string) {
    const next = new Set(selected.value)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    selected.value = next
  }

  function replaceAll(ids: ReadonlyArray<string>) {
    selected.value = new Set(ids)
  }

  function clear() {
    selected.value = new Set()
  }

  function isAllSelected(ids: ReadonlyArray<string>) {
    return ids.length > 0 && ids.every((id) => selected.value.has(id))
  }

  function toggleAll(ids: ReadonlyArray<string>, select: boolean) {
    if (select) {
      replaceAll(ids)
    } else {
      clear()
    }
  }

  return {
    clear,
    has,
    isAllSelected,
    replaceAll,
    selected,
    toggle,
    toggleAll,
  }
}
