<template>
  <div class="sfsr-dock-panel">
    <!-- 顶部标题与多功能工具组 -->
    <div class="sfsr-dock-header">
      <div class="sfsr-dock-header-left">
        <span class="sfsr-dock-title">🔍 全库搜索与替换</span>
      </div>
      <div class="sfsr-dock-header-actions">
        <button
          class="sfsr-dock-action-btn"
          :class="{ 'sfsr-dock-action-btn--active': showPresetsModal }"
          type="button"
          title="常用搜索预设"
          @click="togglePresetsMenu"
        >
          ⭐
        </button>
        <button
          class="sfsr-dock-action-btn"
          :class="{ 'sfsr-dock-action-btn--active': showExportModal }"
          type="button"
          title="批量导出结果"
          @click="toggleExportMenu"
        >
          📋
        </button>
        <button
          class="sfsr-dock-action-btn"
          :class="{ 'sfsr-dock-action-btn--active': showHistoryDrawer }"
          type="button"
          title="替换事务历史与回退"
          @click="openHistoryDrawer"
        >
          📜
        </button>
        <button
          class="sfsr-dock-action-btn"
          :class="{
            'sfsr-dock-action-btn--active': showAdvancedDrawer,
            'sfsr-dock-action-btn--has-filter': hasActiveFilters,
          }"
          type="button"
          :title="showAdvancedDrawer ? '收起高级筛选与排序' : '展开高级筛选与排序 (笔记本/标签/类型/排序)'"
          @click="showAdvancedDrawer = !showAdvancedDrawer"
        >
          ⚙
        </button>
      </div>
    </div>

    <!-- 搜索与替换输入区 -->
    <div class="sfsr-dock-search-box">
      <!-- 搜索输入行 -->
      <div class="sfsr-dock-input-row">
        <button
          class="sfsr-dock-toggle-replace-btn"
          :class="{ 'sfsr-dock-toggle-replace-btn--active': state.replaceVisible }"
          type="button"
          title="展开/折叠替换栏"
          @click="toggleGlobalReplace"
        >
          {{ state.replaceVisible ? '▼' : '▶' }}
        </button>
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
          class="sfsr-dock-search-btn"
          type="button"
          :disabled="state.searching"
          @click="onEnterSearch"
        >
          {{ state.searching ? '...' : '搜索' }}
        </button>
      </div>

      <!-- 替换输入行 (折叠展开) -->
      <div v-if="state.replaceVisible" class="sfsr-dock-replace-row">
        <div class="sfsr-dock-replace-spacer" />
        <input
          v-model="state.replacement"
          class="sfsr-dock-input sfsr-dock-input--replace"
          type="text"
          placeholder="输入全库替换文本..."
          @keydown.enter="onEnterSearch"
          @keydown.esc.stop="onInputEsc"
        >
        <button
          class="sfsr-dock-preview-btn"
          type="button"
          :disabled="!canBatchReplace"
          title="预览差异并安全执行替换"
          @click="openBatchReplaceDiff"
        >
          替换预览
        </button>
      </div>

      <!-- 选项按钮栏 -->
      <div class="sfsr-dock-options">
        <button
          class="sfsr-dock-opt-btn"
          :class="{ 'sfsr-dock-opt-btn--active': state.options.matchCase }"
          title="区分大小写 (Match Case)"
          @click="toggleGlobalOption('matchCase')"
        >
          Aa
        </button>
        <button
          class="sfsr-dock-opt-btn"
          :class="{ 'sfsr-dock-opt-btn--active': state.options.wholeWord }"
          title="全词匹配 (Whole Word)"
          @click="toggleGlobalOption('wholeWord')"
        >
          \b
        </button>
        <button
          class="sfsr-dock-opt-btn"
          :class="{ 'sfsr-dock-opt-btn--active': state.options.useRegex }"
          title="正则表达式 (Regex)"
          @click="toggleGlobalOption('useRegex')"
        >
          .*
        </button>
        <button
          class="sfsr-dock-opt-btn"
          :class="{ 'sfsr-dock-opt-btn--active': state.options.pinyin }"
          title="中文拼音首字母/全拼搜索 (Pinyin)"
          @click="toggleGlobalOption('pinyin')"
        >
          拼
        </button>

        <label
          class="sfsr-dock-switch-label"
          title="仅搜索文档（默认开启）"
        >
          <input
            type="checkbox"
            class="b3-switch sfsr-dock-switch"
            :checked="state.options.docOnly"
            @change="toggleGlobalOption('docOnly')"
          >
          <span class="sfsr-dock-switch-text">仅文档</span>
        </label>

        <button
          class="sfsr-dock-opt-btn sfsr-dock-collapse-btn"
          type="button"
          :title="isAllCollapsed ? '全部展开文档' : '全部折叠文档'"
          :disabled="state.results.length === 0"
          @click="onToggleCollapseAll"
        >
          {{ isAllCollapsed ? '展开' : '折叠' }}
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
        <div class="sfsr-dock-sort-actions">
          <button class="sfsr-dock-mini-btn" type="button" @click="expandAllDocs">
            全部展开
          </button>
          <button class="sfsr-dock-mini-btn" type="button" @click="collapseAllDocs">
            全部折叠
          </button>
        </div>
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
          <span>📋 批量导出搜索结果</span>
          <button class="sfsr-popup-close" type="button" @click="showExportModal = false">✕</button>
        </div>
        <div class="sfsr-popup-body">
          <button class="sfsr-popup-btn" type="button" @click="onExportMarkdown">
            📄 复制为 Markdown 链接列表
          </button>
          <button class="sfsr-popup-btn" type="button" @click="onExportBlockRefs">
            🔗 复制为思源块引用列表 ((id '锚文本'))
          </button>
          <button class="sfsr-popup-btn" type="button" @click="onExportEmbedSql">
            🧩 复制为思源 SQL 嵌入块
          </button>
        </div>
      </div>
    </div>

    <!-- 常用预设管理弹窗 -->
    <div v-if="showPresetsModal" class="sfsr-popup-backdrop" @click.self="showPresetsModal = false">
      <div class="sfsr-popup-modal sfsr-popup-modal--presets">
        <div class="sfsr-popup-header">
          <span>⭐ 常用搜索预设</span>
          <button class="sfsr-popup-close" type="button" @click="showPresetsModal = false">✕</button>
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
              <button class="sfsr-preset-del" type="button" title="删除预设" @click="onDeletePreset(p.id)">
                ✕
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
    || state.sortMode !== 'relevance',
  )
})

const canBatchReplace = computed(() => {
  return Boolean(
    state.query.trim()
    && state.results.length > 0
    && state.totalMatchCount > 0,
  )
})

function onToggleCollapseAll() {
  toggleAllDocsCollapse()
}

function onEnterSearch() {
  executeGlobalSearch()
}

function onInputEsc(e: KeyboardEvent) {
  e.preventDefault()
  e.stopPropagation()
  closeGlobalSearchDockAndReturnFocus()
}

function onSortChange(e: Event) {
  const select = e.target as HTMLSelectElement
  setGlobalSortMode(select.value as GlobalSearchSortMode)
}

function onFiltersChange(nextFilters: GlobalSearchFilters) {
  state.filters = nextFilters
  if (state.query.trim()) {
    executeGlobalSearch()
  }
}

function openBatchReplaceDiff() {
  currentDiffSummary.value = buildVisualDiff(state.results, state.replacement, {
    useRegex: state.options.useRegex,
  })
  showDiffModal.value = true
}

function closeDiffModal() {
  showDiffModal.value = false
}

function onToggleDiffItem(item: DiffItem) {
  item.excluded = !item.excluded
  toggleMatchSelection(item.matchId)
  recalcDiffStats()
}

function onToggleDiffGroup(group: DiffDocumentGroup) {
  const targetExcluded = !group.allExcluded
  group.items.forEach(i => {
    i.excluded = targetExcluded
  })
  group.allExcluded = targetExcluded
  toggleDocSelection(group.rootId)
  recalcDiffStats()
}

function onToggleDiffAll(include: boolean) {
  currentDiffSummary.value.groups.forEach(g => {
    g.allExcluded = !include
    g.items.forEach(i => {
      i.excluded = !include
    })
  })
  state.results.forEach(d => {
    d.matches.forEach(m => {
      m.selectedForReplace = include
    })
  })
  recalcDiffStats()
}

function recalcDiffStats() {
  let inc = 0
  let exc = 0
  for (const g of currentDiffSummary.value.groups) {
    for (const it of g.items) {
      if (it.excluded) exc++
      else inc++
    }
    g.allExcluded = g.items.every(it => it.excluded)
  }
  currentDiffSummary.value.includedCount = inc
  currentDiffSummary.value.excludedCount = exc
  currentDiffSummary.value.affectedDocCount = currentDiffSummary.value.groups.filter(g => g.items.some(i => !i.excluded)).length
}

async function onConfirmExecuteReplace() {
  diffModalRef.value?.setExecutionState(true, 0, currentDiffSummary.value.includedCount)
  try {
    const res = await executeBatchReplace(
      currentDiffSummary.value,
      state.query,
      state.replacement,
      (processed, total) => {
        diffModalRef.value?.setExecutionState(true, processed, total)
      },
    )
    showDiffModal.value = false
    alert(`全库替换完成！共替换 ${res.replacedCount} 处，跳过 ${res.skippedCount} 处。\n可在“历史”中一键回退。`)
    await executeGlobalSearch()
  } catch (err: any) {
    alert(`替换出错: ${err.message || '未知错误'}`)
  } finally {
    diffModalRef.value?.setExecutionState(false)
  }
}

async function openHistoryDrawer() {
  transactionList.value = await loadTransactions()
  showHistoryDrawer.value = true
}

function closeHistoryDrawer() {
  showHistoryDrawer.value = false
}

async function onTransactionReverted() {
  transactionList.value = getTransactions()
  alert('已成功回滚该事务变更！')
  await executeGlobalSearch()
}

const showExportModal = ref(false)
const showPresetsModal = ref(false)
const presetList = ref<SavedSearchPreset[]>([])
const newPresetName = ref('')

function toggleExportMenu() {
  showExportModal.value = !showExportModal.value
}

async function onExportMarkdown() {
  const content = exportAsMarkdownLinks(state.results)
  await copyToClipboard(content)
  alert('已复制 Markdown 链接列表到剪贴板！')
  showExportModal.value = false
}

async function onExportBlockRefs() {
  const content = exportAsBlockRefs(state.results)
  await copyToClipboard(content)
  alert('已复制思源块引用列表到剪贴板！')
  showExportModal.value = false
}

async function onExportEmbedSql() {
  const content = exportAsEmbedQuery(state.results)
  await copyToClipboard(content)
  alert('已复制思源 SQL 嵌入块到剪贴板！')
  showExportModal.value = false
}

async function togglePresetsMenu() {
  showPresetsModal.value = !showPresetsModal.value
  if (showPresetsModal.value) {
    presetList.value = await loadSavedPresets()
  }
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
  background: var(--b3-theme-background, #fff);
  color: var(--b3-theme-on-background, #333);
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
  overflow: hidden;
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
  padding: 2px 5px;
  font-size: 12px;
  cursor: pointer;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  transition: all 0.15s ease;
}

.sfsr-dock-action-btn:hover {
  background: var(--b3-theme-surface-hover, rgba(128, 128, 128, 0.08));
}

.sfsr-dock-action-btn--active {
  background: var(--b3-theme-primary-light, rgba(66, 133, 244, 0.15));
  border-color: var(--b3-theme-primary, #4285f4);
  color: var(--b3-theme-primary, #4285f4);
}

.sfsr-dock-action-btn--has-filter {
  border-color: var(--b3-theme-primary, #4285f4);
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
  background-color: var(--b3-theme-primary, #4285f4);
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
  width: 18px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 10px;
  color: var(--b3-theme-on-surface-light, #888);
  padding: 0;
  flex-shrink: 0;
}

.sfsr-dock-toggle-replace-btn--active {
  color: var(--b3-theme-primary, #4285f4);
}

.sfsr-dock-input {
  flex: 1;
  min-width: 0;
  height: 26px;
  padding: 0 6px;
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.25));
  border-radius: 4px;
  background: var(--b3-theme-surface, #fff);
  color: inherit;
  font-size: 12px;
  outline: none;
}

.sfsr-dock-input:focus {
  border-color: var(--b3-theme-primary, #4285f4);
}

.sfsr-dock-input--replace {
  background: var(--b3-theme-surface, rgba(128, 128, 128, 0.04));
}

.sfsr-dock-search-btn {
  height: 26px;
  padding: 0 8px;
  background: var(--b3-theme-primary, #4285f4);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  white-space: nowrap;
}

.sfsr-dock-search-btn:hover {
  opacity: 0.9;
}

.sfsr-dock-preview-btn {
  height: 26px;
  padding: 0 8px;
  background: var(--b3-theme-warning, #fa8c16);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  white-space: nowrap;
}

.sfsr-dock-preview-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sfsr-dock-options {
  display: flex;
  align-items: center;
  gap: 3px;
  flex-wrap: wrap;
}

.sfsr-dock-opt-btn {
  height: 22px;
  padding: 0 5px;
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.2));
  background: var(--b3-theme-surface, #fff);
  color: var(--b3-theme-on-surface-light, #666);
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
  line-height: 20px;
}

.sfsr-dock-opt-btn--active {
  background: var(--b3-theme-primary-light, rgba(66, 133, 244, 0.15));
  border-color: var(--b3-theme-primary, #4285f4);
  color: var(--b3-theme-primary, #4285f4);
}

.sfsr-dock-switch-label {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  cursor: pointer;
  font-size: 11px;
  color: var(--b3-theme-on-surface-light, #666);
  margin-left: 2px;
}

.sfsr-dock-switch {
  position: relative;
  width: 22px;
  height: 13px;
  background-color: var(--b3-theme-surface-lighter, #d0d5dd);
  border-radius: 7px;
  border: none;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  vertical-align: middle;
  margin: 0;
  transition: background-color 0.2s ease;
}

.sfsr-dock-switch:checked {
  background-color: var(--b3-theme-primary, #4285f4);
}

.sfsr-dock-switch::after {
  content: "";
  position: absolute;
  top: 1.5px;
  left: 1.5px;
  width: 10px;
  height: 10px;
  background-color: #ffffff;
  border-radius: 50%;
  transition: transform 0.2s;
}

.sfsr-dock-switch:checked::after {
  transform: translateX(9px);
}

.sfsr-dock-switch-text {
  font-size: 11px;
  white-space: nowrap;
}

.sfsr-dock-collapse-btn {
  margin-left: auto;
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
  color: var(--b3-theme-on-surface-light, #666);
}

.sfsr-dock-sort-select {
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.2));
  background: var(--b3-theme-background, #fff);
  color: inherit;
  font-size: 11px;
  border-radius: 3px;
  padding: 1px 3px;
}

.sfsr-dock-sort-actions {
  display: flex;
  gap: 4px;
}

.sfsr-dock-mini-btn {
  background: none;
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.15));
  border-radius: 3px;
  padding: 1px 4px;
  font-size: 11px;
  color: var(--b3-theme-on-surface-light, #666);
  cursor: pointer;
}

.sfsr-dock-mini-btn:hover {
  background: var(--b3-theme-surface-hover, rgba(128, 128, 128, 0.08));
}

.sfsr-dock-status {
  padding: 4px 10px;
  font-size: 11px;
  color: var(--b3-theme-on-surface-light, #888);
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
  color: var(--b3-theme-on-surface-light, #888);
  font-size: 12px;
}

.sfsr-dock-empty--error {
  color: var(--b3-theme-error, #f5222d);
}

.sfsr-dock-empty--hint {
  color: var(--b3-theme-on-surface-light, #aaa);
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
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10003;
}

.sfsr-popup-modal {
  width: 340px;
  max-width: 90vw;
  background: var(--b3-theme-background, #fff);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
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

.sfsr-popup-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  color: var(--b3-theme-on-surface-light, #888);
}

.sfsr-popup-body {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sfsr-popup-btn {
  text-align: left;
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.15));
  background: var(--b3-theme-surface, #f9fafb);
  cursor: pointer;
  font-size: 12px;
}

.sfsr-popup-btn:hover {
  background: var(--b3-theme-surface-hover, rgba(128, 128, 128, 0.08));
  border-color: var(--b3-theme-primary, #4285f4);
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
  border-radius: 4px;
  font-size: 12px;
  outline: none;
}

.sfsr-btn--primary {
  height: 28px;
  padding: 0 10px;
  background: var(--b3-theme-primary, #4285f4);
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
  color: #999;
  font-size: 12px;
  padding: 16px 0;
}

.sfsr-preset-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: var(--b3-theme-surface, #f8f9fa);
  border-radius: 4px;
  font-size: 12px;
}

.sfsr-preset-name {
  cursor: pointer;
  color: var(--b3-theme-primary, #4285f4);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320px;
}

.sfsr-preset-del {
  background: none;
  border: none;
  color: var(--b3-theme-error, #f5222d);
  cursor: pointer;
  font-size: 12px;
  padding: 0 4px;
}
</style>
