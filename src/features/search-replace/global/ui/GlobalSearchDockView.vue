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
import {
  executeGlobalSearch,
  globalSearchState as state,
  openGlobalSearch,
  toggleGlobalOption,
} from '../store'
import DocAggregateItem from './DocAggregateItem.vue'

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
  gap: 4px;
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
