<template>
  <div
    v-if="state.visible"
    class="sfsr-workbench-backdrop"
    @click.self="closeGlobalSearch"
  >
    <div
      class="sfsr-workbench-modal"
      @keydown.esc.stop.prevent="closeGlobalSearch"
    >
      <!-- 标题栏 -->
      <div class="sfsr-workbench-header">
        <div class="sfsr-workbench-title">
          <span>🔍 全库搜索与替换工作台</span>
        </div>
        <div class="sfsr-header-actions">
          <button
            class="sfsr-icon-action-btn"
            type="button"
            title="常用搜索预设"
            @click="togglePresetsMenu"
          >
            ⭐ 预设
          </button>
          <button
            class="sfsr-icon-action-btn"
            type="button"
            title="批量导出结果"
            @click="toggleExportMenu"
          >
            📋 导出
          </button>
          <button
            class="sfsr-icon-action-btn"
            type="button"
            title="替换事务历史与回退"
            @click="openHistoryDrawer"
          >
            📜 历史
          </button>
          <button
            class="sfsr-workbench-close"
            type="button"
            title="关闭 (Esc)"
            @click="closeGlobalSearch"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- 输入栏 -->
      <div class="sfsr-workbench-inputs">
        <div class="sfsr-input-row">
          <button
            class="sfsr-toggle-replace-btn"
            :class="{ 'sfsr-toggle-replace-btn--active': state.replaceVisible }"
            type="button"
            title="展开/折叠替换栏"
            @click="toggleGlobalReplace"
          >
            {{ state.replaceVisible ? '▼' : '▶' }}
          </button>

          <input
            ref="inputRef"
            v-model="state.query"
            class="sfsr-query-input"
            type="text"
            placeholder="输入关键词搜索全库文档... (支持 path: tag: type: 语法)"
            @keydown.enter="onEnterSearch"
          >
          <div class="sfsr-option-buttons">
            <button
              class="sfsr-opt-btn"
              :class="{ 'sfsr-opt-btn--active': state.options.matchCase }"
              title="区分大小写 (Match Case)"
              @click="toggleGlobalOption('matchCase')"
            >
              Aa
            </button>
            <button
              class="sfsr-opt-btn"
              :class="{ 'sfsr-opt-btn--active': state.options.wholeWord }"
              title="全词匹配 (Whole Word)"
              @click="toggleGlobalOption('wholeWord')"
            >
              \b
            </button>
            <button
              class="sfsr-opt-btn"
              :class="{ 'sfsr-opt-btn--active': state.options.useRegex }"
              title="正则表达式 (Regex)"
              @click="toggleGlobalOption('useRegex')"
            >
              .*
            </button>
            <button
              class="sfsr-opt-btn"
              :class="{ 'sfsr-opt-btn--active': state.options.pinyin }"
              title="中文拼音首字母/全拼搜索 (Pinyin)"
              @click="toggleGlobalOption('pinyin')"
            >
              拼
            </button>
          </div>
          <button
            class="sfsr-search-action-btn"
            type="button"
            :disabled="state.searching"
            @click="executeGlobalSearch"
          >
            {{ state.searching ? '搜索中...' : '搜索' }}
          </button>
        </div>

        <!-- 替换输入行 -->
        <div v-if="state.replaceVisible" class="sfsr-input-row sfsr-input-row--replace">
          <div class="sfsr-indent-spacer" />
          <input
            v-model="state.replacement"
            class="sfsr-query-input sfsr-query-input--replace"
            type="text"
            placeholder="输入全库替换文本..."
          >
          <button
            class="sfsr-batch-replace-btn"
            type="button"
            :disabled="!canBatchReplace"
            @click="openBatchReplaceDiff"
          >
            批量替换预览...
          </button>
        </div>
      </div>

      <!-- 渐进式过滤胶囊栏 -->
      <FilterPillsBar
        :filters="state.filters"
        :notebooks="notebooks"
        @change="onFiltersChange"
      />

      <!-- 工具栏与排序 -->
      <div class="sfsr-workbench-toolbar">
        <div class="sfsr-toolbar-left">
          <button
            class="sfsr-tool-btn"
            type="button"
            @click="expandAllDocs"
          >
            全部展开
          </button>
          <button
            class="sfsr-tool-btn"
            type="button"
            @click="collapseAllDocs"
          >
            全部折叠
          </button>
          <span class="sfsr-toolbar-divider">|</span>
          <label class="sfsr-sort-label">
            排序:
            <select
              :value="state.sortMode"
              class="sfsr-sort-select"
              @change="onSortChange"
            >
              <option value="relevance">相关度优先</option>
              <option value="updatedDesc">修改时间倒序</option>
              <option value="createdDesc">创建时间倒序</option>
              <option value="readingOrder">路径/阅读顺序</option>
            </select>
          </label>
        </div>

        <div class="sfsr-toolbar-right">
          <span v-if="state.statusMessage" class="sfsr-status-summary">
            {{ state.statusMessage }}
          </span>
        </div>
      </div>

      <!-- 结果列表 -->
      <div class="sfsr-workbench-body">
        <div v-if="state.searching" class="sfsr-workbench-state">
          <span>正在高速检索全库数据...</span>
        </div>

        <div v-else-if="state.error" class="sfsr-workbench-state sfsr-workbench-state--error">
          <span>{{ state.error }}</span>
        </div>

        <div v-else-if="state.results.length === 0 && state.query.trim()" class="sfsr-workbench-state">
          <span>未找到匹配的文档内容</span>
        </div>

        <div v-else-if="!state.query.trim()" class="sfsr-workbench-state sfsr-workbench-state--hint">
          <span>输入关键词并按 Enter 开始全局检索</span>
        </div>

        <div v-else class="sfsr-results-list">
          <DocAggregateItem
            v-for="doc in state.results"
            :key="doc.rootId"
            :doc="doc"
          />
        </div>
      </div>
    </div>

    <!-- Visual Diff 差异对比视窗 -->
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

    <!-- 预设管理弹窗 -->
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
              <button class="sfsr-preset-del" type="button" @click="onDeletePreset(p.id)">
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
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import {
  closeGlobalSearch,
  collapseAllDocs,
  executeGlobalSearch,
  expandAllDocs,
  globalSearchState as state,
  setGlobalSortMode,
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
import DocAggregateItem from './DocAggregateItem.vue'
import FilterPillsBar from './FilterPillsBar.vue'
import VisualDiffModal from './VisualDiffModal.vue'
import TransactionHistoryDrawer from './TransactionHistoryDrawer.vue'
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

const inputRef = ref<HTMLInputElement>()
const diffModalRef = ref<InstanceType<typeof VisualDiffModal>>()

const notebooks = ref<NotebookInfo[]>([])
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

const canBatchReplace = computed(() => {
  return Boolean(
    state.query.trim()
    && state.results.length > 0
    && state.totalMatchCount > 0,
  )
})

function onEnterSearch() {
  executeGlobalSearch()
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
    // 重新检索刷新视图
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
  notebooks.value = await fetchNotebooks()
})

watch(
  () => state.visible,
  async (visible) => {
    if (visible) {
      await nextTick()
      inputRef.value?.focus()
      inputRef.value?.select()
      if (notebooks.value.length === 0) {
        notebooks.value = await fetchNotebooks()
      }
    }
  },
)
</script>

<style scoped>
.sfsr-workbench-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.45);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 50px;
  z-index: 9999;
  backdrop-filter: blur(2px);
}

.sfsr-workbench-modal {
  width: 780px;
  max-width: 94vw;
  max-height: 86vh;
  background: var(--b3-theme-background, #fff);
  border-radius: 8px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.25);
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.2));
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sfsr-workbench-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.15));
}

.sfsr-workbench-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--b3-theme-on-background, #333);
}

.sfsr-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sfsr-icon-action-btn {
  background: none;
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.2));
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;
  color: var(--b3-theme-on-surface, #555);
}

.sfsr-icon-action-btn:hover {
  background: var(--b3-theme-surface-hover, rgba(128, 128, 128, 0.08));
}

.sfsr-workbench-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: var(--b3-theme-on-surface-light, #888);
  padding: 4px 8px;
  border-radius: 4px;
}

.sfsr-workbench-close:hover {
  background: var(--b3-theme-surface-hover, rgba(128, 128, 128, 0.1));
}

.sfsr-workbench-inputs {
  padding: 10px 16px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sfsr-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sfsr-input-row--replace {
  margin-top: 2px;
}

.sfsr-indent-spacer {
  width: 24px;
}

.sfsr-toggle-replace-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--b3-theme-on-surface-light, #888);
  font-size: 11px;
}

.sfsr-toggle-replace-btn--active {
  color: var(--b3-theme-primary, #4285f4);
}

.sfsr-query-input {
  flex: 1;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.3));
  border-radius: 4px;
  background: var(--b3-theme-surface, #f8f9fa);
  color: var(--b3-theme-on-surface, #333);
  font-size: 13px;
  outline: none;
}

.sfsr-query-input:focus {
  border-color: var(--b3-theme-primary, #4285f4);
}

.sfsr-query-input--replace {
  background: var(--b3-theme-surface, #fff);
}

.sfsr-option-buttons {
  display: flex;
  gap: 4px;
}

.sfsr-opt-btn {
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.2));
  background: var(--b3-theme-surface, #fff);
  color: var(--b3-theme-on-surface-light, #666);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.sfsr-opt-btn--active {
  background: var(--b3-theme-primary-light, rgba(66, 133, 244, 0.15));
  border-color: var(--b3-theme-primary, #4285f4);
  color: var(--b3-theme-primary, #4285f4);
}

.sfsr-search-action-btn {
  height: 32px;
  padding: 0 16px;
  background: var(--b3-theme-primary, #4285f4);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.sfsr-search-action-btn:hover {
  opacity: 0.9;
}

.sfsr-batch-replace-btn {
  height: 32px;
  padding: 0 14px;
  background: var(--b3-theme-warning, #fa8c16);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.sfsr-batch-replace-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sfsr-workbench-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  background: var(--b3-theme-surface, rgba(128, 128, 128, 0.04));
  border-bottom: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.1));
  font-size: 12px;
}

.sfsr-toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sfsr-tool-btn {
  background: none;
  border: none;
  font-size: 11px;
  color: var(--b3-theme-on-surface-light, #666);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 3px;
}

.sfsr-tool-btn:hover {
  background: var(--b3-theme-surface-hover, rgba(128, 128, 128, 0.1));
}

.sfsr-toolbar-divider {
  color: var(--b3-border-color, #ccc);
}

.sfsr-sort-label {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--b3-theme-on-surface-light, #666);
}

.sfsr-sort-select {
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.2));
  background: var(--b3-theme-background, #fff);
  color: inherit;
  font-size: 11px;
  border-radius: 3px;
  padding: 2px 4px;
}

.sfsr-status-summary {
  color: var(--b3-theme-on-surface-light, #888);
}

.sfsr-workbench-body {
  flex: 1;
  overflow-y: auto;
  min-height: 280px;
  max-height: 56vh;
  padding: 8px 12px;
}

.sfsr-workbench-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 240px;
  color: var(--b3-theme-on-surface-light, #888);
  font-size: 13px;
}

.sfsr-workbench-state--error {
  color: var(--b3-theme-error, #f5222d);
}

.sfsr-workbench-state--hint {
  color: var(--b3-theme-on-surface-light, #aaa);
}

.sfsr-results-list {
  display: flex;
  flex-direction: column;
}

.sfsr-popup-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.35);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10003;
}

.sfsr-popup-modal {
  width: 380px;
  max-width: 90vw;
  background: var(--b3-theme-background, #fff);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sfsr-popup-modal--presets {
  width: 440px;
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
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.25));
  border-radius: 4px;
  font-size: 12px;
  outline: none;
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
