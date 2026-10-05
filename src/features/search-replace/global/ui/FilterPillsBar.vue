<template>
  <div class="sfsr-pills-bar">
    <!-- 内容类型胶囊 -->
    <div class="sfsr-pill-group">
      <span class="sfsr-pill-label">类型:</span>
      <button
        v-for="item in typeOptions"
        :key="item.key"
        type="button"
        class="sfsr-pill"
        :class="{ 'sfsr-pill--active': isTypeSelected(item.key) }"
        @click="toggleType(item.key)"
      >
        {{ item.label }}
      </button>
    </div>

    <!-- 时间范围胶囊 -->
    <div class="sfsr-pill-group">
      <span class="sfsr-pill-label">更新时间:</span>
      <button
        v-for="item in timeOptions"
        :key="item.key"
        type="button"
        class="sfsr-pill"
        :class="{ 'sfsr-pill--active': isTimeSelected(item.key) }"
        @click="selectTimeRange(item.key)"
      >
        {{ item.label }}
      </button>
    </div>

    <!-- 笔记本胶囊 -->
    <div v-if="notebooks.length > 0" class="sfsr-pill-group">
      <span class="sfsr-pill-label">笔记本:</span>
      <select
        :value="filters.notebookId || ''"
        class="sfsr-pill-select"
        @change="onNotebookChange"
      >
        <option value="">全部笔记本</option>
        <option
          v-for="nb in notebooks"
          :key="nb.id"
          :value="nb.id"
        >
          {{ nb.name || nb.id }}
        </option>
      </select>
    </div>

    <!-- 重置过滤按钮 -->
    <button
      v-if="hasActiveFilters"
      type="button"
      class="sfsr-pill-reset"
      @click="resetFilters"
    >
      重置过滤
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GlobalSearchFilters } from '../types'
import type { NotebookInfo } from '../kernel-query'

const props = defineProps<{
  filters: GlobalSearchFilters
  notebooks?: NotebookInfo[]
}>()

const emit = defineEmits<{
  (e: 'change', filters: GlobalSearchFilters): void
}>()

const notebooks = computed(() => props.notebooks || [])

const typeOptions = [
  { key: 'p', label: '正文' },
  { key: 'h', label: '标题' },
  { key: 'c', label: '代码' },
  { key: 't', label: '表格' },
]

const timeOptions = [
  { key: 'today', label: '今天' },
  { key: '3d', label: '近3天' },
  { key: '7d', label: '近7天' },
  { key: '30d', label: '近30天' },
]

function isTypeSelected(key: string) {
  return props.filters.types?.includes(key)
}

function toggleType(key: string) {
  const current = [...(props.filters.types || [])]
  const idx = current.indexOf(key)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    current.push(key)
  }
  emit('change', { ...props.filters, types: current })
}

function calculateStartDate(key: string): string {
  const now = new Date()
  if (key === 'today') {
    now.setHours(0, 0, 0, 0)
  } else if (key === '3d') {
    now.setDate(now.getDate() - 3)
  } else if (key === '7d') {
    now.setDate(now.getDate() - 7)
  } else if (key === '30d') {
    now.setDate(now.getDate() - 3)
  }
  const Y = now.getFullYear()
  const M = String(now.getMonth() + 1).padStart(2, '0')
  const D = String(now.getDate()).padStart(2, '0')
  return `${Y}${M}${D}000000`
}

function isTimeSelected(key: string) {
  const target = calculateStartDate(key)
  return props.filters.dateRange?.start === target
}

function selectTimeRange(key: string) {
  const currentStart = props.filters.dateRange?.start
  const target = calculateStartDate(key)
  if (currentStart === target) {
    emit('change', { ...props.filters, dateRange: undefined })
  } else {
    emit('change', {
      ...props.filters,
      dateRange: { start: target },
    })
  }
}

function onNotebookChange(e: Event) {
  const select = e.target as HTMLSelectElement
  const val = select.value.trim()
  emit('change', {
    ...props.filters,
    notebookId: val || undefined,
  })
}

const hasActiveFilters = computed(() => {
  return Boolean(
    (props.filters.types && props.filters.types.length > 0)
    || props.filters.notebookId
    || props.filters.dateRange?.start
    || (props.filters.tags && props.filters.tags.length > 0),
  )
})

function resetFilters() {
  emit('change', {
    tags: [],
    types: [],
    notebookId: undefined,
    dateRange: undefined,
  })
}
</script>

<style scoped>
.sfsr-pills-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 6px 16px;
  background: var(--b3-theme-surface, #f9fafb);
  border-bottom: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.1));
  font-size: 11px;
}

.sfsr-pill-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sfsr-pill-label {
  color: var(--b3-theme-on-surface-light, #888);
  margin-right: 2px;
}

.sfsr-pill {
  padding: 2px 7px;
  border-radius: 12px;
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.2));
  background: var(--b3-theme-background, #fff);
  color: var(--b3-theme-on-surface, #555);
  cursor: pointer;
  font-size: 11px;
  transition: all 0.15s ease;
}

.sfsr-pill:hover {
  border-color: var(--b3-theme-primary, #4285f4);
}

.sfsr-pill--active {
  background: var(--b3-theme-primary, #4285f4);
  border-color: var(--b3-theme-primary, #4285f4);
  color: #fff;
  font-weight: 500;
}

.sfsr-pill-select {
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.2));
  border-radius: 10px;
  background: var(--b3-theme-background, #fff);
  color: inherit;
  font-size: 11px;
  padding: 1px 6px;
  outline: none;
}

.sfsr-pill-reset {
  background: none;
  border: none;
  color: var(--b3-theme-error, #f5222d);
  cursor: pointer;
  font-size: 11px;
  margin-left: auto;
}

.sfsr-pill-reset:hover {
  text-decoration: underline;
}
</style>
