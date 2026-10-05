<template>
  <div class="sfsr-dock-panel">
    <!-- 顶部标题与多功能工具组 -->
    <div class="sfsr-dock-header">
      <div class="sfsr-dock-header-left">
        <span class="sfsr-dock-title-icon">
          <WireframeIcon name="search" :size="14" />
        </span>
        <span class="sfsr-dock-title">全库搜索与替换</span>
      </div>
      <div class="sfsr-dock-header-actions">
        <button
          class="sfsr-dock-action-btn b3-tooltips b3-tooltips__sw"
          :class="{ 'sfsr-dock-action-btn--active': showPresetsModal }"
          type="button"
          aria-label="常用搜索预设"
          @click="togglePresetsMenu"
        >
          <WireframeIcon name="star" :size="13" />
        </button>
        <button
          class="sfsr-dock-action-btn b3-tooltips b3-tooltips__sw"
          :class="{ 'sfsr-dock-action-btn--active': showExportModal }"
          type="button"
          aria-label="批量导出结果"
          @click="toggleExportMenu"
        >
          <WireframeIcon name="export" :size="13" />
        </button>
        <button
          class="sfsr-dock-action-btn b3-tooltips b3-tooltips__sw"
          :class="{ 'sfsr-dock-action-btn--active': showHistoryDrawer }"
          type="button"
          aria-label="替换事务历史与回退"
          @click="openHistoryDrawer"
        >
          <WireframeIcon name="history" :size="13" />
        </button>
        <button
          class="sfsr-dock-action-btn b3-tooltips b3-tooltips__sw"
          :class="{
            'sfsr-dock-action-btn--active': showAdvancedDrawer,
            'sfsr-dock-action-btn--has-filter': hasActiveFilters,
          }"
          type="button"
          :aria-label="showAdvancedDrawer ? '收起高级筛选' : '高级筛选与排序'"
          @click="showAdvancedDrawer = !showAdvancedDrawer"
        >
          <WireframeIcon name="filter" :size="13" />
        </button>
      </div>
    </div>

    <!-- 搜索与替换输入区 -->
    <div class="sfsr-dock-search-box">
      <!-- 搜索输入行 -->
      <div class="sfsr-dock-input-row">
        <button
          class="sfsr-dock-toggle-replace-btn b3-tooltips b3-tooltips__se"
          :class="{ 'sfsr-dock-toggle-replace-btn--active': state.replaceVisible }"
          type="button"
          :aria-label="state.replaceVisible ? '收起替换栏' : '展开替换栏'"
          @click="toggleGlobalReplace"
        >
          <WireframeIcon :name="state.replaceVisible ? 'chevron-down' : 'chevron-right'" :size="12" />
        </button>

        <div class="sfsr-dock-input-wrapper">
          <input
            ref="inputRef"
            v-model="state.query"
            class="sfsr-dock-input"
            type="text"
            placeholder="搜索全库... (Enter 搜, Esc 关)"
            @keydown.enter="onEnterSearch"
            @keydown.esc.stop="onInputEsc"
          >
          <button
            v-if="state.query"
            class="sfsr-dock-clear-btn b3-tooltips b3-tooltips__s"
            type="button"
            aria-label="清空搜索词"
            @click="clearQuery"
          >
            <WireframeIcon name="clear" :size="12" />
          </button>
        </div>

        <button
          class="sfsr-dock-search-btn b3-tooltips b3-tooltips__w"
          type="button"
          :disabled="state.searching"
          aria-label="执行搜索 (Enter)"
          @click="onEnterSearch"
        >
          <WireframeIcon :name="state.searching ? 'history' : 'enter'" :size="13" />
        </button>
      </div>

      <!-- 替换输入行 (折叠展开) -->
      <div v-if="state.replaceVisible" class="sfsr-dock-replace-row">
        <div class="sfsr-dock-replace-spacer" />
        <div class="sfsr-dock-input-wrapper">
          <input
            v-model="state.replacement"
            class="sfsr-dock-input sfsr-dock-input--replace"
            type="text"
            placeholder="输入全库替换文本..."
            @keydown.enter="onEnterSearch"
            @keydown.esc.stop="onInputEsc"
          >
          <button
            v-if="state.replacement"
            class="sfsr-dock-clear-btn b3-tooltips b3-tooltips__s"
            type="button"
            aria-label="清空替换词"
            @click="state.replacement = ''"
          >
            <WireframeIcon name="clear" :size="12" />
          </button>
        </div>

        <button
          class="sfsr-dock-preview-btn b3-tooltips b3-tooltips__w"
          type="button"
          :disabled="!canBatchReplace"
          aria-label="差异预览与替换"
          @click="openBatchReplaceDiff"
        >
          <WireframeIcon name="diff" :size="13" />
        </button>
      </div>

      <!-- 选项按钮栏 -->
      <div class="sfsr-dock-options">
        <div class="sfsr-dock-segmented-group">
          <button
            class="sfsr-dock-opt-btn b3-tooltips b3-tooltips__se"
            :class="{ 'sfsr-dock-opt-btn--active': state.options.matchCase }"
            type="button"
            :aria-label="state.options.matchCase ? '区分大小写（已开启）' : '区分大小写 (Match Case)'"
            @click="toggleGlobalOption('matchCase')"
          >
            Aa
          </button>
          <button
            class="sfsr-dock-opt-btn b3-tooltips b3-tooltips__s"
            :class="{ 'sfsr-dock-opt-btn--active': state.options.wholeWord }"
            type="button"
            :aria-label="state.options.wholeWord ? '全词匹配（已开启）' : '全词匹配 (Whole Word)'"
            @click="toggleGlobalOption('wholeWord')"
          >
            \b
          </button>
          <button
            class="sfsr-dock-opt-btn b3-tooltips b3-tooltips__s"
            :class="{ 'sfsr-dock-opt-btn--active': state.options.useRegex }"
            type="button"
            :aria-label="state.options.useRegex ? '正则表达式（已开启）' : '正则表达式 (Regex)'"
            @click="toggleGlobalOption('useRegex')"
          >
            .*
          </button>
          <button
            class="sfsr-dock-opt-btn b3-tooltips b3-tooltips__sw"
            :class="{ 'sfsr-dock-opt-btn--active': state.options.pinyin }"
            type="button"
            :aria-label="state.options.pinyin ? '拼音搜索（已开启）' : '拼音搜索 (Pinyin)'"
            @click="toggleGlobalOption('pinyin')"
          >
            拼
          </button>
        </div>

        <label
          class="sfsr-dock-opt-btn sfsr-dock-opt-chip b3-tooltips b3-tooltips__s"
          :class="{ 'sfsr-dock-opt-btn--active': state.options.docOnly }"
          :aria-label="state.options.docOnly ? '仅匹配文档（已开启）' : '仅匹配文档'"
        >
          <input
            type="checkbox"
            class="sfsr-dock-switch"
            :checked="state.options.docOnly"
            style="display: none;"
            @change="toggleGlobalOption('docOnly')"
          >
          <WireframeIcon name="document" :size="11" />
          <span class="sfsr-dock-chip-text">仅文档</span>
        </label>

        <button
          class="sfsr-dock-opt-btn sfsr-dock-collapse-btn b3-tooltips b3-tooltips__sw"
          type="button"
          :aria-label="isAllCollapsed ? '全部展开文档' : '全部折叠文档'"
          :disabled="state.results.length === 0"
          @click="onToggleCollapseAll"
        >
          <WireframeIcon :name="isAllCollapsed ? 'expand-all' : 'collapse-all'" :size="12" />
        </button>
      </div>
    </div>

    <!-- 高级筛选与排序抽屉 (折叠展示) -->
    <div v-if="showAdvancedDrawer" class="sfsr-dock-advanced-drawer">
      <FilterPillsBar
        :filters="state.filters"
        :notebooks="notebooks"
        @change="onFiltersChange"
      />
      <div class="sfsr-dock-sort-row">
        <label class="sfsr-dock-sort-label">
          排序:
          <select
            :value="state.sortMode"
            class="sfsr-dock-sort-select"
            @change="onSortChange"
          >
            <option value="relevance">相关度优先</option>
            <option value="updatedDesc">修改时间倒序</option>
            <option value="createdDesc">创建时间倒序</option>
            <option value="readingOrder">路径/阅读顺序</option>
          </select>
        </label>
      </div>
    </div>

    <!-- 结果统计提示 -->
    <div v-if="state.statusMessage" class="sfsr-dock-status">
      {{ state.statusMessage }}
    </div>

    <!-- 结果列表 -->
    <div class="sfsr-dock-body">
      <div v-if="state.searching" class="sfsr-dock-empty">
        正在高速检索全库数据...
      </div>
      <div v-else-if="state.error" class="sfsr-dock-empty sfsr-dock-empty--error">
        {{ state.error }}
      </div>
      <div v-else-if="state.results.length === 0 && state.query.trim()" class="sfsr-dock-empty">
        未找到匹配文档内容
      </div>
      <div v-else-if="!state.query.trim()" class="sfsr-dock-empty sfsr-dock-empty--hint">
        输入关键词并按 Enter 全库检索
      </div>
      <div v-else class="sfsr-dock-results">
        <DocAggregateItem
          v-for="doc in state.results"
          :key="doc.rootId"
          :doc="doc"
        />
      </div>
    </div>

    <!-- Visual Diff 差异对比视窗 (屏幕居中宽屏 Modal) -->
    <VisualDiffModal
      ref="diffModalRef"
      :visible="showDiffModal"
      :diff-summary="currentDiffSummary"
      @cancel="closeDiffModal"
      @confirm="onConfirmExecuteReplace"
      @toggle-item="onToggleDiffItem"
      @toggle-group="onToggleDiffGroup"
      @toggle-all="onToggleDiffAll"
    />

    <!-- 事务历史抽屉 -->
    <TransactionHistoryDrawer
      :visible="showHistoryDrawer"
      :transactions="transactionList"
      @close="closeHistoryDrawer"
      @reverted="onTransactionReverted"
    />

    <!-- 批量导出弹窗 -->
    <div v-if="showExportModal" class="sfsr-popup-backdrop" @click.self="showExportModal = false">
      <div class="sfsr-popup-modal">
        <div class="sfsr-popup-header">
          <span class="sfsr-popup-title-wrap">
            <WireframeIcon name="export" :size="14" />
            <span>批量导出搜索结果</span>
          </span>
          <button class="sfsr-popup-close" type="button" aria-label="关闭弹窗" @click="showExportModal = false">
            <WireframeIcon name="close" :size="13" />
          </button>
        </div>
        <div class="sfsr-popup-body">
          <button class="sfsr-popup-btn" type="button" @click="onExportMarkdown">
            <WireframeIcon name="document" :size="13" />
            <span>复制为 Markdown 链接列表</span>
          </button>
          <button class="sfsr-popup-btn" type="button" @click="onExportBlockRefs">
            <WireframeIcon name="link" :size="13" />
            <span>复制为思源块引用列表 ((id '锚文本'))</span>
          </button>
          <button class="sfsr-popup-btn" type="button" @click="onExportEmbedSql">
            <WireframeIcon name="code" :size="13" />
            <span>复制为思源 SQL 嵌入块</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 常用预设管理弹窗 -->
    <div v-if="showPresetsModal" class="sfsr-popup-backdrop" @click.self="showPresetsModal = false">
      <div class="sfsr-popup-modal sfsr-popup-modal--presets">
        <div class="sfsr-popup-header">
          <span class="sfsr-popup-title-wrap">
            <WireframeIcon name="star" :size="14" />
            <span>常用搜索预设</span>
          </span>
          <button class="sfsr-popup-close" type="button" aria-label="关闭弹窗" @click="showPresetsModal = false">
            <WireframeIcon name="close" :size="13" />
          </button>
        </div>
        <div class="sfsr-popup-body">
          <div class="sfsr-preset-create-row">
            <input
              v-model="newPresetName"
              class="sfsr-preset-input"
              type="text"
              placeholder="输入新预设名称..."
              @keydown.enter="onSaveCurrentAsPreset"
            >
            <button class="sfsr-btn sfsr-btn--primary" type="button" @click="onSaveCurrentAsPreset">
              保存当前条件
            </button>
          </div>
          <div class="sfsr-preset-list">
            <div v-if="presetList.length === 0" class="sfsr-empty-tip">
              暂无保存的预设
            </div>
            <div
              v-for="p in presetList"
              :key="p.id"
              class="sfsr-preset-item"
            >
              <span class="sfsr-preset-name" @click="onApplyPreset(p)">
                <strong>{{ p.name }}</strong> ({{ p.query }})
              </span>
              <button class="sfsr-preset-del" type="button" aria-label="删除预设" @click="onDeletePreset(p.id)">
                <WireframeIcon name="close" :size="12" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import {
  collapseAllDocs,
  executeGlobalSearch,
  expandAllDocs,
  globalSearchState as state,
  setGlobalSortMode,
  toggleAllDocsCollapse,
  toggleDocSelection,
  toggleGlobalOption,
  toggleGlobalReplace,
  toggleMatchSelection,
} from '../store'
import type { GlobalSearchFilters, GlobalSearchSortMode } from '../types'
import { fetchNotebooks, type NotebookInfo } from '../kernel-query'
import { buildVisualDiff, type DiffDocumentGroup, type DiffItem, type DiffSummary } from '../diff-builder'
import { executeBatchReplace } from '../replace-engine'
import {
  getTransactions,
  loadTransactions,
  type ReplaceTransaction,
} from '../transaction-history'
import {
  copyToClipboard,
  exportAsBlockRefs,
  exportAsEmbedQuery,
  exportAsMarkdownLinks,
} from '../export-utils'
import {
  deletePreset,
  getSavedPresets,
  loadSavedPresets,
  savePreset,
  type SavedSearchPreset,
} from '../saved-presets'
import {
  closeGlobalSearchDockAndReturnFocus,
  registerGlobalSearchInput,
} from '../dock-manager'
import DocAggregateItem from './DocAggregateItem.vue'
import FilterPillsBar from './FilterPillsBar.vue'
import VisualDiffModal from './VisualDiffModal.vue'
import TransactionHistoryDrawer from './TransactionHistoryDrawer.vue'
import WireframeIcon from '@/components/SiyuanTheme/WireframeIcon.vue'

const inputRef = ref<HTMLInputElement>()
const diffModalRef = ref<InstanceType<typeof VisualDiffModal>>()

const notebooks = ref<NotebookInfo[]>([])
const showAdvancedDrawer = ref(false)
const showDiffModal = ref(false)
const showHistoryDrawer = ref(false)
const transactionList = ref<ReplaceTransaction[]>([])

const currentDiffSummary = ref<DiffSummary>({
  totalCount: 0,
  includedCount: 0,
  excludedCount: 0,
  affectedDocCount: 0,
  groups: [],
})

const isAllCollapsed = computed(() => {
  return state.results.length > 0 && state.results.every(d => d.collapsed)
})

const hasActiveFilters = computed(() => {
  return Boolean(
    state.filters.notebookId
    || state.filters.pathPrefix
    || (state.filters.tags && state.filters.tags.length > 0)
    || (state.filters.types && state.filters.types.length > 0)
    || state.filters.dateRange?.start,
  )
})

const canBatchReplace = computed(() => {
  return (
    state.query.trim().length > 0
    && state.results.length > 0
    && !state.searching
  )
})

function onEnterSearch() {
  executeGlobalSearch()
}

function onInputEsc() {
  closeGlobalSearchDockAndReturnFocus()
}

function clearQuery() {
  state.query = ''
  nextTick(() => {
    inputRef.value?.focus()
  })
}

function onToggleCollapseAll() {
  toggleAllDocsCollapse()
}

function onFiltersChange(newFilters: GlobalSearchFilters) {
  state.filters = { ...newFilters }
  executeGlobalSearch()
}

function onSortChange(e: Event) {
  const select = e.target as HTMLSelectElement
  const mode = select.value as GlobalSearchSortMode
  setGlobalSortMode(mode)
}

function openBatchReplaceDiff() {
  if (!canBatchReplace.value) {
    return
  }
  const summary = buildVisualDiff(state.results, state.query, state.replacement, {
    useRegex: state.options.useRegex,
    matchCase: state.options.matchCase,
    wholeWord: state.options.wholeWord,
  })
  currentDiffSummary.value = summary
  showDiffModal.value = true
}

function closeDiffModal() {
  showDiffModal.value = false
}

function onToggleDiffItem(item: DiffItem) {
  item.excluded = !item.excluded
  recalculateDiffSummary()
}

function onToggleDiffGroup(group: DiffDocumentGroup) {
  const targetExcluded = !group.allExcluded
  for (const item of group.items) {
    item.excluded = targetExcluded
  }
  recalculateDiffSummary()
}

function onToggleDiffAll(included: boolean) {
  for (const group of currentDiffSummary.value.groups) {
    for (const item of group.items) {
      item.excluded = !included
    }
  }
  recalculateDiffSummary()
}

function recalculateDiffSummary() {
  let inc = 0
  let exc = 0
  let docCount = 0
  for (const g of currentDiffSummary.value.groups) {
    let groupHasInc = false
    let groupAllExc = true
    for (const item of g.items) {
      if (item.excluded) {
        exc++
      } else {
        inc++
        groupHasInc = true
        groupAllExc = false
      }
    }
    g.allExcluded = groupAllExc
    if (groupHasInc) {
      docCount++
    }
  }
  currentDiffSummary.value.includedCount = inc
  currentDiffSummary.value.excludedCount = exc
  currentDiffSummary.value.affectedDocCount = docCount
}

async function onConfirmExecuteReplace() {
  diffModalRef.value?.setExecuting(true)
  try {
    const success = await executeBatchReplace(
      currentDiffSummary.value,
      state.query,
      state.replacement,
      {
        useRegex: state.options.useRegex,
        matchCase: state.options.matchCase,
        wholeWord: state.options.wholeWord,
      },
      (processed, total) => {
        diffModalRef.value?.setProgress(processed, total)
      },
    )
    if (success) {
      showDiffModal.value = false
      await executeGlobalSearch()
    }
  } finally {
    diffModalRef.value?.setExecuting(false)
  }
}

async function openHistoryDrawer() {
  await loadTransactions()
  transactionList.value = getTransactions()
  showHistoryDrawer.value = true
}

function closeHistoryDrawer() {
  showHistoryDrawer.value = false
}

async function onTransactionReverted() {
  transactionList.value = getTransactions()
  await executeGlobalSearch()
}

// 导出与预设弹窗
const showExportModal = ref(false)
const showPresetsModal = ref(false)
const newPresetName = ref('')
const presetList = ref<SavedSearchPreset[]>([])

function toggleExportMenu() {
  showExportModal.value = !showExportModal.value
}

async function onExportMarkdown() {
  const content = exportAsMarkdownLinks(state.results)
  const ok = await copyToClipboard(content)
  showExportModal.value = false
  if (ok) {
    state.statusMessage = '已复制 Markdown 链接列表到剪贴板'
  }
}

async function onExportBlockRefs() {
  const content = exportAsBlockRefs(state.results)
  const ok = await copyToClipboard(content)
  showExportModal.value = false
  if (ok) {
    state.statusMessage = '已复制思源块引用列表到剪贴板'
  }
}

async function onExportEmbedSql() {
  const content = exportAsEmbedQuery(state.query, state.filters)
  const ok = await copyToClipboard(content)
  showExportModal.value = false
  if (ok) {
    state.statusMessage = '已复制思源 SQL 嵌入块到剪贴板'
  }
}

async function togglePresetsMenu() {
  if (!showPresetsModal.value) {
    await loadSavedPresets()
    presetList.value = getSavedPresets()
  }
  showPresetsModal.value = !showPresetsModal.value
}

async function onSaveCurrentAsPreset() {
  if (!newPresetName.value.trim()) {
    alert('请输入预设名称')
    return
  }
  await savePreset(newPresetName.value, {
    query: state.query,
    replacement: state.replacement,
    options: state.options,
    filters: state.filters,
  })
  newPresetName.value = ''
  presetList.value = getSavedPresets()
  alert('预设保存成功！')
}

function onApplyPreset(preset: SavedSearchPreset) {
  state.query = preset.query
  state.replacement = preset.replacement || ''
  state.options = { ...preset.options }
  state.filters = { ...preset.filters }
  showPresetsModal.value = false
  executeGlobalSearch()
}

async function onDeletePreset(id: string) {
  await deletePreset(id)
  presetList.value = getSavedPresets()
}

onMounted(async () => {
  registerGlobalSearchInput(inputRef.value || null)
  try {
    notebooks.value = await fetchNotebooks()
  } catch {
  }
})

onUnmounted(() => {
  registerGlobalSearchInput(null)
})
</script>

<style scoped>
.sfsr-dock-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  overflow: hidden;
  font-size: 12px;
}

.sfsr-dock-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  border-bottom: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.15));
  gap: 6px;
}

.sfsr-dock-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
}

.sfsr-dock-title-icon {
  display: inline-flex;
  align-items: center;
  color: var(--b3-theme-primary);
}

.sfsr-dock-title {
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sfsr-dock-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sfsr-dock-action-btn {
  background: none;
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.2));
  border-radius: 4px;
  width: 24px;
  height: 24px;
  padding: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--b3-theme-on-surface);
  transition: all 0.15s ease;
}

.sfsr-dock-action-btn:hover {
  background: var(--b3-theme-surface-hover, var(--b3-list-hover, rgba(128, 128, 128, 0.08)));
  color: var(--b3-theme-on-background);
}

.sfsr-dock-action-btn--active {
  background: var(--b3-theme-primary) !important;
  border-color: var(--b3-theme-primary) !important;
  color: #ffffff !important;
}

.sfsr-dock-action-btn--active :where(svg, path, circle, rect, polygon, polyline, line, g) {
  stroke: #ffffff !important;
  fill: none !important;
}

.sfsr-dock-action-btn--has-filter {
  border-color: var(--b3-theme-primary);
  position: relative;
}

.sfsr-dock-action-btn--has-filter::after {
  content: '';
  position: absolute;
  top: -2px;
  right: -2px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background-color: var(--b3-theme-primary);
}

.sfsr-dock-action-btn--active.sfsr-dock-action-btn--has-filter::after {
  background-color: #ffffff;
}

.sfsr-dock-search-box {
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  border-bottom: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.1));
}

.sfsr-dock-input-row,
.sfsr-dock-replace-row {
  display: flex;
  gap: 4px;
  align-items: center;
}

.sfsr-dock-toggle-replace-btn,
.sfsr-dock-replace-spacer {
  width: 20px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--b3-theme-on-surface-light);
  padding: 0;
  flex-shrink: 0;
}

.sfsr-dock-toggle-replace-btn:hover {
  color: var(--b3-theme-on-background);
}

.sfsr-dock-toggle-replace-btn--active {
  color: var(--b3-theme-primary);
}

.sfsr-dock-input-wrapper {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  min-width: 0;
}

.sfsr-dock-input {
  width: 100%;
  height: 26px;
  padding: 0 22px 0 6px;
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.25));
  border-radius: 4px;
  background: var(--b3-theme-surface, transparent);
  color: inherit;
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s ease;
}

.sfsr-dock-input:focus {
  border-color: var(--b3-theme-primary);
}

.sfsr-dock-input--replace {
  background: var(--b3-theme-surface, rgba(128, 128, 128, 0.04));
}

.sfsr-dock-clear-btn {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  padding: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--b3-theme-on-surface-light);
  cursor: pointer;
  opacity: 0.6;
}

.sfsr-dock-clear-btn:hover {
  opacity: 1;
  color: var(--b3-theme-on-background);
}

.sfsr-dock-search-btn {
  height: 26px;
  width: 26px;
  background: var(--b3-theme-primary);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: opacity 0.15s ease;
}

.sfsr-dock-search-btn:hover {
  opacity: 0.9;
}

.sfsr-dock-preview-btn {
  height: 26px;
  width: 26px;
  background: var(--b3-theme-warning, #fa8c16);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: opacity 0.15s ease;
}

.sfsr-dock-preview-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.sfsr-dock-options {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.sfsr-dock-segmented-group {
  display: inline-flex;
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.2));
  border-radius: 4px;
  overflow: visible;
  background: var(--b3-theme-surface, transparent);
  position: relative;
}

.sfsr-dock-segmented-group .sfsr-dock-opt-btn {
  border: none;
  border-right: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.15));
  border-radius: 0;
  height: 22px;
  padding: 0 6px;
  position: relative;
}

.sfsr-dock-segmented-group .sfsr-dock-opt-btn:first-child {
  border-top-left-radius: 3px;
  border-bottom-left-radius: 3px;
}

.sfsr-dock-segmented-group .sfsr-dock-opt-btn:last-child {
  border-top-right-radius: 3px;
  border-bottom-right-radius: 3px;
  border-right: none;
}

.sfsr-dock-segmented-group .sfsr-dock-opt-btn:hover {
  z-index: 5;
}

.sfsr-dock-opt-btn {
  height: 22px;
  padding: 0 6px;
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.2));
  background: var(--b3-theme-surface, transparent);
  color: var(--b3-theme-on-surface-light);
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  transition: all 0.15s ease;
}

.sfsr-dock-opt-btn:hover {
  color: var(--b3-theme-on-background);
  background: var(--b3-theme-surface-hover, var(--b3-list-hover, rgba(128, 128, 128, 0.08)));
}

.sfsr-dock-opt-btn--active {
  background: var(--b3-theme-primary) !important;
  border-color: var(--b3-theme-primary) !important;
  color: #ffffff !important;
}

.sfsr-dock-opt-btn--active :where(svg, path, circle, rect, polygon, polyline, line, g) {
  stroke: #ffffff !important;
  fill: none !important;
}

.sfsr-dock-opt-btn--active .sfsr-dock-chip-text {
  color: #ffffff !important;
  font-weight: 600;
}

.sfsr-dock-opt-chip {
  padding: 0 6px;
}

.sfsr-dock-chip-text {
  font-size: 11px;
}

.sfsr-dock-collapse-btn {
  margin-left: auto;
  width: 22px;
  height: 22px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.sfsr-dock-advanced-drawer {
  padding: 6px 10px;
  background: var(--b3-theme-surface, rgba(128, 128, 128, 0.04));
  border-bottom: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.1));
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sfsr-dock-sort-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
}

.sfsr-dock-sort-label {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--b3-theme-on-surface-light);
}

.sfsr-dock-sort-select {
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.2));
  background: var(--b3-theme-background);
  color: inherit;
  font-size: 11px;
  border-radius: 3px;
  padding: 1px 3px;
  outline: none;
}

.sfsr-dock-status {
  padding: 4px 10px;
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  border-bottom: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.08));
  background: var(--b3-theme-surface, rgba(128, 128, 128, 0.02));
}

.sfsr-dock-body {
  flex: 1;
  overflow-y: auto;
  padding: 6px 8px;
}

.sfsr-dock-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 120px;
  color: var(--b3-theme-on-surface-light);
  font-size: 12px;
}

.sfsr-dock-empty--error {
  color: var(--b3-theme-error);
}

.sfsr-dock-empty--hint {
  color: var(--b3-theme-on-surface-light);
  opacity: 0.7;
}

.sfsr-dock-results {
  display: flex;
  flex-direction: column;
}

/* 弹窗遮罩与弹窗卡片 (预设/导出) */
.sfsr-popup-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: var(--b3-mask-background, rgba(0, 0, 0, 0.48));
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10003;
}

.sfsr-popup-modal {
  width: 340px;
  max-width: 90vw;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  box-shadow: var(--b3-dialog-shadow, 0 8px 24px rgba(0, 0, 0, 0.2));
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sfsr-popup-modal--presets {
  width: 400px;
}

.sfsr-popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.15));
  font-weight: 600;
  font-size: 13px;
}

.sfsr-popup-title-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--b3-theme-primary);
}

.sfsr-popup-close {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  color: var(--b3-theme-on-surface-light);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.sfsr-popup-close:hover {
  color: var(--b3-theme-on-background);
}

.sfsr-popup-body {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sfsr-popup-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.15));
  background: var(--b3-theme-surface, transparent);
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s ease;
}

.sfsr-popup-btn:hover {
  background: var(--b3-theme-surface-hover, var(--b3-list-hover, rgba(128, 128, 128, 0.08)));
  border-color: var(--b3-theme-primary);
  color: var(--b3-theme-on-background);
}

.sfsr-preset-create-row {
  display: flex;
  gap: 6px;
}

.sfsr-preset-input {
  flex: 1;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.25));
  background: var(--b3-theme-surface, transparent);
  color: inherit;
  border-radius: 4px;
  font-size: 12px;
  outline: none;
}

.sfsr-preset-input:focus {
  border-color: var(--b3-theme-primary);
}

.sfsr-btn--primary {
  height: 28px;
  padding: 0 10px;
  background: var(--b3-theme-primary);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
}

.sfsr-preset-list {
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}

.sfsr-empty-tip {
  text-align: center;
  color: var(--b3-theme-on-surface-light);
  font-size: 12px;
  padding: 16px 0;
}

.sfsr-preset-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: var(--b3-theme-surface, transparent);
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.1));
  border-radius: 4px;
  font-size: 12px;
}

.sfsr-preset-name {
  cursor: pointer;
  color: var(--b3-theme-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320px;
}

.sfsr-preset-del {
  background: none;
  border: none;
  color: var(--b3-theme-error);
  cursor: pointer;
  font-size: 12px;
  padding: 2px;
  display: inline-flex;
  align-items: center;
}
</style>
