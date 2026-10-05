<template>
  <div class="sfsr-dock-panel">
    <!-- 顶部标题与放大按钮 -->
    <div class="sfsr-dock-header">
      <span class="sfsr-dock-title">🔍 全库搜索</span>
      <button
        class="sfsr-dock-btn"
        type="button"
        title="打开全屏搜索工作台 (Ctrl+Shift+F)"
        @click="openModalWorkbench"
      >
        ⛶ 全屏工作台
      </button>
    </div>

    <!-- 搜索输入框 -->
    <div class="sfsr-dock-search-box">
      <div class="sfsr-dock-input-row">
        <input
          v-model="state.query"
          class="sfsr-dock-input"
          type="text"
          placeholder="搜索全库文档... (Enter)"
          @keydown.enter="onEnterSearch"
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

      <!-- 选项按钮 -->
      <div class="sfsr-dock-options">
        <button
          class="sfsr-dock-opt-btn"
          :class="{ 'sfsr-dock-opt-btn--active': state.options.matchCase }"
          title="区分大小写"
          @click="toggleGlobalOption('matchCase')"
        >
          Aa
        </button>
        <button
          class="sfsr-dock-opt-btn"
          :class="{ 'sfsr-dock-opt-btn--active': state.options.wholeWord }"
          title="全词匹配"
          @click="toggleGlobalOption('wholeWord')"
        >
          \b
        </button>
        <button
          class="sfsr-dock-opt-btn"
          :class="{ 'sfsr-dock-opt-btn--active': state.options.useRegex }"
          title="正则表达式"
          @click="toggleGlobalOption('useRegex')"
        >
          .*
        </button>
        <button
          class="sfsr-dock-opt-btn"
          :class="{ 'sfsr-dock-opt-btn--active': state.options.pinyin }"
          title="中文拼音首字母/全拼搜索"
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
          <span class="sfsr-dock-switch-text">仅搜索文档</span>
        </label>

        <button
          class="sfsr-dock-opt-btn sfsr-dock-collapse-btn"
          type="button"
          :title="isAllCollapsed ? '全部展开文档' : '全部折叠文档'"
          :disabled="state.results.length === 0"
          @click="onToggleCollapseAll"
        >
          {{ isAllCollapsed ? '全部展开' : '全部折叠' }}
        </button>
      </div>
    </div>

    <!-- 结果统计 -->
    <div v-if="state.statusMessage" class="sfsr-dock-status">
      {{ state.statusMessage }}
    </div>

    <!-- 结果列表 -->
    <div class="sfsr-dock-body">
      <div v-if="state.searching" class="sfsr-dock-empty">
        正在高速检索全库...
      </div>
      <div v-else-if="state.results.length === 0 && state.query.trim()" class="sfsr-dock-empty">
        未找到匹配内容
      </div>
      <div v-else-if="!state.query.trim()" class="sfsr-dock-empty sfsr-dock-empty--hint">
        输入关键词并按 Enter 搜索
      </div>
      <div v-else class="sfsr-dock-results">
        <DocAggregateItem
          v-for="doc in state.results"
          :key="doc.rootId"
          :doc="doc"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  executeGlobalSearch,
  globalSearchState as state,
  openGlobalSearch,
  toggleAllDocsCollapse,
  toggleGlobalOption,
} from '../store'
import DocAggregateItem from './DocAggregateItem.vue'

const isAllCollapsed = computed(() => {
  return state.results.length > 0 && state.results.every(d => d.collapsed)
})

function onToggleCollapseAll() {
  toggleAllDocsCollapse()
}

function onEnterSearch() {
  executeGlobalSearch()
}

function openModalWorkbench() {
  openGlobalSearch()
}
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
  padding: 8px 12px;
  border-bottom: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.15));
}

.sfsr-dock-title {
  font-weight: 600;
  font-size: 13px;
}

.sfsr-dock-btn {
  background: none;
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.2));
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  cursor: pointer;
  color: var(--b3-theme-primary, #4285f4);
}

.sfsr-dock-btn:hover {
  background: var(--b3-theme-surface-hover, rgba(128, 128, 128, 0.08));
}

.sfsr-dock-search-box {
  padding: 8px 12px 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-bottom: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.1));
}

.sfsr-dock-input-row {
  display: flex;
  gap: 6px;
}

.sfsr-dock-input {
  flex: 1;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.25));
  border-radius: 4px;
  background: var(--b3-theme-surface, #f8f9fa);
  color: var(--b3-theme-on-surface, #333);
  font-size: 12px;
  outline: none;
}

.sfsr-dock-input:focus {
  border-color: var(--b3-theme-primary, #4285f4);
}

.sfsr-dock-search-btn {
  height: 28px;
  padding: 0 10px;
  background: var(--b3-theme-primary, #4285f4);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.sfsr-dock-options {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.sfsr-dock-switch-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  user-select: none;
  font-size: 11px;
  margin-left: 6px;
  color: var(--b3-theme-on-surface-light, #666);
  line-height: 1;
}

.sfsr-dock-switch-label:hover {
  color: var(--b3-theme-primary, #4285f4);
}

.sfsr-dock-switch {
  position: relative;
  width: 26px;
  height: 15px;
  background-color: var(--b3-theme-surface-lighter, #d0d5dd);
  border-radius: 8px;
  border: none;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  transition: background-color 0.2s ease;
  vertical-align: middle;
  flex-shrink: 0;
  margin: 0;
}

.sfsr-dock-switch:checked {
  background-color: var(--b3-theme-primary, #4285f4);
}

.sfsr-dock-switch::after {
  content: "";
  position: absolute;
  top: 1.5px;
  left: 1.5px;
  width: 12px;
  height: 12px;
  background-color: #ffffff;
  border-radius: 50%;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.sfsr-dock-switch:checked::after {
  transform: translateX(11px);
}

.sfsr-dock-switch-text {
  white-space: nowrap;
  font-size: 11px;
}

.sfsr-dock-opt-btn {
  height: 24px;
  padding: 0 6px;
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.2));
  background: var(--b3-theme-surface, #fff);
  color: var(--b3-theme-on-surface-light, #666);
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
}

.sfsr-dock-collapse-btn {
  margin-left: auto;
  white-space: nowrap;
}

.sfsr-dock-collapse-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sfsr-dock-opt-btn--active {
  background: var(--b3-theme-primary-light, rgba(66, 133, 244, 0.15));
  border-color: var(--b3-theme-primary, #4285f4);
  color: var(--b3-theme-primary, #4285f4);
}

.sfsr-dock-status {
  padding: 4px 12px;
  font-size: 11px;
  color: var(--b3-theme-on-surface-light, #888);
  background: var(--b3-theme-surface, rgba(128, 128, 128, 0.04));
  border-bottom: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.08));
}

.sfsr-dock-body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px;
}

.sfsr-dock-empty {
  text-align: center;
  color: #999;
  padding: 40px 10px;
  font-size: 12px;
}

.sfsr-dock-empty--hint {
  color: #bbb;
}

.sfsr-dock-results {
  display: flex;
  flex-direction: column;
}
</style>
