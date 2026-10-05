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
          <span>🔍 全库搜索工作台</span>
        </div>
        <button
          class="sfsr-workbench-close"
          type="button"
          title="关闭 (Esc)"
          @click="closeGlobalSearch"
        >
          ✕
        </button>
      </div>

      <!-- 输入栏 -->
      <div class="sfsr-workbench-inputs">
        <div class="sfsr-input-row">
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
      </div>

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
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import {
  closeGlobalSearch,
  collapseAllDocs,
  executeGlobalSearch,
  expandAllDocs,
  globalSearchState as state,
  setGlobalSortMode,
  toggleGlobalOption,
} from '../store'
import type { GlobalSearchSortMode } from '../types'
import DocAggregateItem from './DocAggregateItem.vue'

const inputRef = ref<HTMLInputElement>()

function onEnterSearch() {
  executeGlobalSearch()
}

function onSortChange(e: Event) {
  const select = e.target as HTMLSelectElement
  setGlobalSortMode(select.value as GlobalSearchSortMode)
}

watch(
  () => state.visible,
  async (visible) => {
    if (visible) {
      await nextTick()
      inputRef.value?.focus()
      inputRef.value?.select()
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
  padding-top: 60px;
  z-index: 9999;
  backdrop-filter: blur(2px);
}

.sfsr-workbench-modal {
  width: 760px;
  max-width: 92vw;
  max-height: 82vh;
  background: var(--b3-theme-background, #fff);
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
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
  padding: 12px 16px 8px;
}

.sfsr-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sfsr-query-input {
  flex: 1;
  height: 34px;
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

.sfsr-option-buttons {
  display: flex;
  gap: 4px;
}

.sfsr-opt-btn {
  height: 32px;
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
  height: 34px;
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
  max-height: 58vh;
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
</style>
