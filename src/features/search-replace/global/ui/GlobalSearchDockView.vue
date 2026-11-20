<template>
  <div class="sfsr-dock-panel">
    <!-- 顶部标题与多功能工具组 -->
    <div class="sfsr-dock-header">
      <div class="sfsr-dock-header-left">
        <span class="sfsr-dock-title-icon">
          <WireframeIcon
            name="search"
            :size="14"
          />
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
          <WireframeIcon
            name="star"
            :size="13"
          />
        </button>
        <button
          class="sfsr-dock-action-btn b3-tooltips b3-tooltips__sw"
          :class="{ 'sfsr-dock-action-btn--active': showExportModal }"
          type="button"
          aria-label="批量导出结果"
          @click="toggleExportMenu"
        >
          <WireframeIcon
            name="export"
            :size="13"
          />
        </button>
        <button
          class="sfsr-dock-action-btn b3-tooltips b3-tooltips__sw"
          type="button"
          aria-label="替换事务历史与回退（分屏页签打开）"
          @click="openHistoryTab"
        >
          <WireframeIcon
            name="history"
            :size="13"
          />
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
          <WireframeIcon
            name="filter"
            :size="13"
          />
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
          <WireframeIcon
            :name="state.replaceVisible ? 'chevron-down' : 'chevron-right'"
            :size="12"
          />
        </button>

        <div class="sfsr-dock-input-wrapper">
          <input
            ref="inputRef"
            v-model="state.query"
            class="sfsr-dock-input sfsr-dock-input--search"
            type="text"
            placeholder="搜索全库... (Enter 搜, Esc 关)"
            @keydown.enter="onEnterSearch"
            @keydown.esc.stop="onInputEsc"
          >
          <div class="sfsr-dock-input-actions">
            <button
              v-if="state.query"
              class="sfsr-dock-clear-btn b3-tooltips b3-tooltips__s"
              type="button"
              aria-label="清空搜索词"
              @click="clearQuery"
            >
              <WireframeIcon
                name="clear"
                :size="12"
              />
            </button>
            <div
              class="sfsr-dock-help-wrap"
              @mouseenter="onHelpMouseEnter"
              @mouseleave="onHelpMouseLeave"
            >
              <button
                class="sfsr-dock-help-btn"
                type="button"
                aria-label="搜索语法与样例"
                @click.stop="toggleHelpPopover"
              >
                <WireframeIcon
                  name="help"
                  :size="12"
                />
              </button>
            </div>
          </div>
        </div>

        <button
          class="sfsr-dock-search-btn b3-tooltips b3-tooltips__w"
          type="button"
          :disabled="state.searching"
          aria-label="执行搜索 (Enter)"
          @click="onEnterSearch"
        >
          <WireframeIcon
            :name="state.searching ? 'history' : 'enter'"
            :size="13"
          />
        </button>
      </div>

      <!-- 搜索语法与样例卡片 (直接以 search-box 为定位容器，狭窄侧栏下自动限制在容器内，左侧绝不遮挡) -->
      <SearchHelpPopover
        v-if="showHelpPopover"
        @mouseenter="onHelpMouseEnter"
        @mouseleave="onHelpMouseLeave"
        @select-example="onSelectHelpExample"
        @close="closeHelpPopover"
      />

      <!-- 替换输入行 (折叠展开) -->
      <div
        v-if="state.replaceVisible"
        class="sfsr-dock-replace-row"
      >
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
            <WireframeIcon
              name="clear"
              :size="12"
            />
          </button>
        </div>

        <button
          class="sfsr-dock-preview-btn b3-tooltips b3-tooltips__w"
          type="button"
          :disabled="!canBatchReplace"
          :aria-label="replaceBtnTooltip"
          @click="openBatchReplaceDiff"
        >
          <WireframeIcon
            name="diff"
            :size="13"
          />
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
            class="sfsr-dock-opt-btn"
            :class="{
              'sfsr-dock-opt-btn--active': state.options.useRegex,
              'b3-tooltips b3-tooltips__s': !state.options.useRegex,
            }"
            type="button"
            :aria-label="state.options.useRegex ? undefined : '正则表达式 (Regex)'"
            @mouseenter="onRegexBtnMouseEnter"
            @mouseleave="onRegexBtnMouseLeave"
            @click="onToggleRegexOption"
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
          <WireframeIcon
            name="document"
            :size="11"
          />
          <span class="sfsr-dock-chip-text">仅文档</span>
        </label>

        <button
          class="sfsr-dock-opt-btn sfsr-dock-collapse-btn b3-tooltips b3-tooltips__sw"
          type="button"
          :aria-label="isAllCollapsed ? '全部展开文档' : '全部折叠文档'"
          :disabled="state.results.length === 0"
          @click="onToggleCollapseAll"
        >
          <WireframeIcon
            :name="isAllCollapsed ? 'expand-all' : 'collapse-all'"
            :size="12"
          />
        </button>
      </div>

      <!-- 正则表达式语法与样例卡片 -->
      <RegexHelpPopover
        v-if="showRegexHelpPopover"
        @mouseenter="onRegexHelpMouseEnter"
        @mouseleave="onRegexHelpMouseLeave"
        @select-example="onSelectRegexHelpExample"
        @close="closeRegexHelpPopover"
      />
    </div>

    <!-- 高级筛选与排序抽屉 (折叠展示) -->
    <div
      v-if="showAdvancedDrawer"
      class="sfsr-dock-advanced-drawer"
    >
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
    <div
      v-if="state.statusMessage && !isDraftQuery"
      class="sfsr-dock-status"
    >
      {{ state.statusMessage }}
    </div>

    <!-- 结果列表 -->
    <div class="sfsr-dock-body">
      <div
        v-if="state.searching"
        class="sfsr-dock-empty"
      >
        正在高速检索全库数据...
      </div>
      <div
        v-else-if="state.error"
        class="sfsr-dock-empty sfsr-dock-empty--error"
      >
        {{ state.error }}
      </div>
      <div
        v-else-if="!state.query.trim()"
        class="sfsr-dock-empty sfsr-dock-empty--hint"
      >
        输入关键词并按 Enter 全库检索
      </div>
      <div
        v-else-if="isDraftQuery"
        class="sfsr-dock-empty sfsr-dock-empty--draft"
      >
        按 Enter 检索: {{ displayDraftKeyword }}
      </div>
      <div
        v-else-if="state.results.length === 0"
        class="sfsr-dock-empty"
      >
        未找到匹配文档内容
      </div>
      <div
        v-else
        class="sfsr-dock-results"
      >
        <DocAggregateItem
          v-for="doc in state.results"
          :key="doc.rootId"
          :doc="doc"
        />
      </div>
    </div>

    <!-- Visual Diff 差异对比视窗 (屏幕居中宽屏 Modal) -->
    <Teleport to="body">
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
    </Teleport>


    <!-- 批量导出弹窗 -->
    <ExportResultsModal
      :visible="showExportModal"
      @close="showExportModal = false"
    />

    <!-- 常用预设管理弹窗 -->
    <PresetsModal
      :visible="showPresetsModal"
      @close="showPresetsModal = false"
      @apply="onApplyPreset"
    />
  </div>
</template>

<script setup lang="ts">
import type { NotebookInfo } from '../kernel-query'
import type { SavedSearchPreset } from '../saved-presets'
import type {
  GlobalSearchFilters,
  GlobalSearchSortMode,
} from '../types'
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue'
import WireframeIcon from '@/components/SiyuanTheme/WireframeIcon.vue'
import { t } from '@/i18n/runtime'
import {
  closeGlobalSearchDockAndReturnFocus,
  registerGlobalSearchInput,
} from '../dock-manager'
import { hasActiveGlobalFilters } from '../filter-utils'
import { openReplaceHistoryTab } from '../history-tab-manager'
import { fetchNotebooks } from '../kernel-query'
import { parseGlobalQuery } from '../query-parser'
import {
  clearGlobalSearchResults,
  executeGlobalSearch,
  setGlobalQuery,
  setGlobalSortMode,
  globalSearchState as state,
  toggleAllDocsCollapse,
  toggleGlobalOption,
  toggleGlobalReplace,
} from '../store'


import DocAggregateItem from './DocAggregateItem.vue'
import ExportResultsModal from './ExportResultsModal.vue'
import FilterPillsBar from './FilterPillsBar.vue'
import PresetsModal from './PresetsModal.vue'
import RegexHelpPopover from './RegexHelpPopover.vue'
import SearchHelpPopover from './SearchHelpPopover.vue'
import {
  useBatchReplaceDiff,
  useCanBatchReplace,
} from './use-batch-replace-diff'
import { useHoverPopover } from './use-hover-popover'
import VisualDiffModal from './VisualDiffModal.vue'

const inputRef = ref<HTMLInputElement>()
const diffModalRef = ref<InstanceType<typeof VisualDiffModal>>()

const notebooks = ref<NotebookInfo[]>([])
const showAdvancedDrawer = ref(false)

const isDraftQuery = computed(() => {
  const trimmed = state.query.trim()
  return Boolean(trimmed && trimmed !== state.searchedQuery)
})

const displayDraftKeyword = computed(() => {
  const trimmed = state.query.trim()
  if (trimmed.length > 25) {
    return `${trimmed.slice(0, 25)}...`
  }
  return trimmed
})

watch(
  () => state.query,
  (newVal) => {
    // 与 setGlobalQuery 的语义保持单一实现：query 变化后按需清空过期结果。
    // 此处 state.query 已是 newVal，setGlobalQuery 内的同值赋值不会再次触发响应。
    // 注意（RF-107）：测试 global-search-dock 直接改写 state.query 并依赖本 watch
    // 立即清空旧结果，因此输入框保持 v-model + watch 机制而非改为单写路径。
    setGlobalQuery(newVal)
  },
)

const isAllCollapsed = computed(() => {
  return state.results.length > 0 && state.results.every((d) => d.collapsed)
})

const hasActiveFilters = computed(() => hasActiveGlobalFilters(state.filters))

const parsedCurrentQuery = computed(() => parseGlobalQuery(state.query))

const canBatchReplace = useCanBatchReplace(parsedCurrentQuery)

const replaceBtnTooltip = computed(() => {
  if (parsedCurrentQuery.value.isMultiTermQuery) {
    return t('multiTermReplaceDisabled')
  }
  return '差异预览与替换'
})

// 搜索语法 / 正则两个 hover 弹窗（RF-107：抽离共用的延迟开启/关闭计时器逻辑）
const {
  isOpen: showHelpPopover,
  close: closeHelpPopover,
  open: openHelpPopover,
  scheduleClose: scheduleHelpPopoverClose,
} = useHoverPopover()

const {
  isOpen: showRegexHelpPopover,
  close: closeRegexHelpPopover,
  open: openRegexHelpPopover,
  scheduleOpen: scheduleRegexHelpPopoverOpen,
  scheduleClose: scheduleRegexHelpPopoverClose,
  cancelOpenTimer: cancelRegexOpenTimer,
} = useHoverPopover({
  openDelay: 250,
  closeDelay: 160,
  // 正则弹窗实际开启时互斥关闭搜索语法弹窗（与原 onRegexBtnMouseEnter 时序一致）
  onOpen: () => closeHelpPopover(),
})

function onRegexBtnMouseEnter() {
  if (!state.options.useRegex) {
    return
  }
  scheduleRegexHelpPopoverOpen()
}

function onRegexBtnMouseLeave() {
  cancelRegexOpenTimer()
  if (showRegexHelpPopover.value) {
    scheduleRegexHelpPopoverClose()
  }
}

function onRegexHelpMouseEnter() {
  openRegexHelpPopover()
}

function onRegexHelpMouseLeave() {
  scheduleRegexHelpPopoverClose()
}

function onToggleRegexOption() {
  closeRegexHelpPopover()
  toggleGlobalOption('useRegex')
}

function onSelectRegexHelpExample(example: string) {
  state.query = example
  closeRegexHelpPopover()
  nextTick(() => {
    inputRef.value?.focus()
    executeGlobalSearch()
  })
}

function onHelpMouseEnter() {
  // 打开搜索语法弹窗时互斥关闭正则弹窗（原行为）
  closeRegexHelpPopover()
  openHelpPopover()
}

function onHelpMouseLeave() {
  scheduleHelpPopoverClose()
}

function toggleHelpPopover() {
  closeRegexHelpPopover()
  if (showHelpPopover.value) {
    closeHelpPopover()
  } else {
    openHelpPopover()
  }
}

function onSelectHelpExample(example: string) {
  state.query = example
  closeHelpPopover()
  nextTick(() => {
    inputRef.value?.focus()
    executeGlobalSearch()
  })
}

function onEnterSearch(event?: KeyboardEvent | MouseEvent) {
  if ((event as KeyboardEvent)?.isComposing) {
    return
  }
  executeGlobalSearch()
}

function onInputEsc() {
  if (showHelpPopover.value || showRegexHelpPopover.value) {
    closeHelpPopover()
    closeRegexHelpPopover()
    return
  }
  closeGlobalSearchDockAndReturnFocus()
}

function clearQuery() {
  state.query = ''
  state.searchedQuery = ''
  clearGlobalSearchResults()
  nextTick(() => {
    inputRef.value?.focus()
  })
}

function onToggleCollapseAll() {
  toggleAllDocsCollapse()
}

function onFiltersChange(newFilters: GlobalSearchFilters) {
  state.filters = { ...newFilters }
  // 选中类型胶囊时自动关闭“仅文档”，否则 SQL 强制 type='d' 会吞掉类型过滤
  if (newFilters.types && newFilters.types.length > 0 && state.options.docOnly) {
    state.options.docOnly = false
  }
  const currentQuery = state.query.trim()
  if (currentQuery && currentQuery === state.searchedQuery) {
    executeGlobalSearch()
  }
}

function onSortChange(e: Event) {
  const select = e.target as HTMLSelectElement
  const mode = select.value as GlobalSearchSortMode
  setGlobalSortMode(mode)
}

// 批量替换 Diff 弹窗编排（RF-107：抽离至 use-batch-replace-diff.ts）
const keywordForReplace = computed(() => parsedCurrentQuery.value.singleKeyword || state.query)
const {
  closeDiffModal,
  currentDiffSummary,
  onConfirmExecuteReplace,
  onToggleDiffAll,
  onToggleDiffGroup,
  onToggleDiffItem,
  openBatchReplaceDiff,
  showDiffModal,
} = useBatchReplaceDiff({
  canBatchReplace,
  diffModalRef,
  singleKeywordForReplace: keywordForReplace,
})

async function openHistoryTab() {
  await openReplaceHistoryTab('right')
}

// 导出与预设弹窗的可见性（内容与动作在各自组件内闭环）
const showExportModal = ref(false)
const showPresetsModal = ref(false)

function toggleExportMenu() {
  showExportModal.value = !showExportModal.value
}

function togglePresetsMenu() {
  showPresetsModal.value = !showPresetsModal.value
}

function onApplyPreset(preset: SavedSearchPreset) {
  state.query = preset.query
  state.replacement = preset.replacement || ''
  state.options = { ...preset.options }
  state.filters = { ...preset.filters }
  showPresetsModal.value = false
  executeGlobalSearch()
}

onMounted(async () => {
  registerGlobalSearchInput(inputRef.value || null)
  try {
    notebooks.value = await fetchNotebooks()
  } catch {
  }
})

watch(
  () => state.options.useRegex,
  (val) => {
    if (!val) {
      closeRegexHelpPopover()
    }
  },
)

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
  isolation: isolate;
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
  position: relative;
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

.sfsr-dock-input--search {
  padding-right: 44px;
}

.sfsr-dock-input:focus {
  border-color: var(--b3-theme-primary);
}

.sfsr-dock-input--replace {
  background: var(--b3-theme-surface, rgba(128, 128, 128, 0.04));
}

.sfsr-dock-input-actions {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 2px;
  z-index: 2;
}

.sfsr-dock-input-actions .sfsr-dock-clear-btn {
  position: static;
  transform: none;
}

.sfsr-dock-help-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.sfsr-dock-help-btn {
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
  opacity: 0.65;
  transition: opacity 0.12s ease, color 0.12s ease;
}

.sfsr-dock-help-btn:hover {
  opacity: 1;
  color: var(--b3-theme-primary);
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
  color: var(--b3-theme-on-surface);
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
  color: var(--b3-theme-on-surface);
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
  color: var(--b3-theme-on-surface);
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
  color: var(--b3-theme-on-surface);
  font-size: 12px;
}

.sfsr-dock-empty--error {
  color: var(--b3-theme-error);
}

.sfsr-dock-empty--hint {
  color: var(--b3-theme-on-surface-light);
}

.sfsr-dock-empty--draft {
  color: var(--b3-theme-primary);
  font-weight: 500;
}

.sfsr-dock-results {
  display: flex;
  flex-direction: column;
}

</style>
