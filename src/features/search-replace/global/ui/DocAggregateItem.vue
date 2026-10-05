<template>
  <div class="sfsr-doc-item" :class="{ 'sfsr-doc-item--collapsed': doc.collapsed }">
    <div
      class="sfsr-doc-item__header"
      @click="onToggleCollapse"
    >
      <span
        class="sfsr-doc-item__arrow"
        :class="{ 'sfsr-doc-item__arrow--expanded': !doc.collapsed }"
      >▶</span>

      <span class="sfsr-doc-item__icon">📄</span>

      <span class="sfsr-doc-item__title" :title="doc.hpath || doc.docTitle">
        {{ doc.docTitle }}
      </span>

      <span v-if="doc.hpath" class="sfsr-doc-item__path" :title="doc.hpath">
        {{ doc.hpath }}
      </span>

      <span class="sfsr-doc-item__count">
        {{ doc.totalCount }}
      </span>
    </div>

    <div v-if="!doc.collapsed" class="sfsr-doc-item__matches">
      <div
        v-for="match in doc.matches"
        :key="match.matchId"
        class="sfsr-match-item"
        :class="{ 'sfsr-match-item--selected': isSelected(match.matchId) }"
        @click="onClickMatch(match)"
      >
        <span class="sfsr-match-item__type-badge">
          {{ formatBlockType(match.blockType, match) }}
        </span>

        <span class="sfsr-match-item__snippet">
          <template v-for="(seg, idx) in match.segments" :key="idx">
            <mark v-if="seg.isMatch" class="sfsr-match-item__highlight">{{ seg.text }}</mark>
            <span v-else>{{ seg.text }}</span>
          </template>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DocAggregateNode, GlobalBlockType, GlobalMatchSnippet } from '../types'
import {
  globalSearchState,
  navigateToGlobalMatch,
  toggleDocCollapse,
} from '../store'

const props = defineProps<{
  doc: DocAggregateNode
}>()

function onToggleCollapse() {
  toggleDocCollapse(props.doc.rootId)
}

function onClickMatch(match: GlobalMatchSnippet) {
  navigateToGlobalMatch(match)
}

function isSelected(matchId: string) {
  return globalSearchState.selectedMatchId === matchId
}

function formatBlockType(type: GlobalBlockType, match?: GlobalMatchSnippet): string {
  // 1. 标题块：h1-h6 或 type 为 h，明确标识为“标题”
  if (type === 'h' || (match?.subType && /^h[1-6]$/i.test(match.subType))) {
    return '标题'
  }

  // 2. 文档根块：type 为 d/doc，或者块ID为根文档ID，标识为“文档”
  if (type === 'd' || type === 'doc' || (match && match.blockId === match.rootId)) {
    return '文档'
  }

  // 3. 具体已支持的细分块类型
  switch (type) {
    case 'p': return '段落'
    case 'c': return '代码'
    case 't': return '表格'
    case 'l': return '列表'
    case 'i': return '项'
    case 'b': return '引述'
    case 'm': return '公式'
    case 's': return '超级块'
    case 'av': return '数据库'
    // 4. 其余所有未细分的块类型标识为“块”
    default: return '块'
  }
}
</script>

<style scoped>
.sfsr-doc-item {
  border-bottom: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.15));
}

.sfsr-doc-item__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  cursor: pointer;
  user-select: none;
  background-color: var(--b3-theme-surface, transparent);
  transition: background-color 0.15s ease;
}

.sfsr-doc-item__header:hover {
  background-color: var(--b3-theme-surface-hover, rgba(128, 128, 128, 0.08));
}

.sfsr-doc-item__arrow {
  font-size: 10px;
  color: var(--b3-theme-on-surface-light, #888);
  transition: transform 0.15s ease;
  display: inline-block;
}

.sfsr-doc-item__arrow--expanded {
  transform: rotate(90deg);
}

.sfsr-doc-item__icon {
  font-size: 14px;
}

.sfsr-doc-item__title {
  font-weight: 600;
  font-size: 13px;
  color: var(--b3-theme-on-background, #333);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sfsr-doc-item__path {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light, #999);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  margin-left: 4px;
}

.sfsr-doc-item__count {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--b3-theme-primary-light, rgba(66, 133, 244, 0.15));
  color: var(--b3-theme-primary, #4285f4);
  font-weight: bold;
}

.sfsr-doc-item__matches {
  padding-left: 20px;
}

.sfsr-match-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 5px 8px;
  font-size: 12px;
  cursor: pointer;
  line-height: 1.5;
  border-radius: 4px;
  transition: background-color 0.15s ease;
}

.sfsr-match-item:hover {
  background-color: var(--b3-theme-surface-hover, rgba(128, 128, 128, 0.08));
}

.sfsr-match-item--selected {
  background-color: var(--b3-theme-primary-light, rgba(66, 133, 244, 0.15));
}

.sfsr-match-item__type-badge {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 3px;
  background: var(--b3-theme-surface-lighter, rgba(128, 128, 128, 0.15));
  color: var(--b3-theme-on-surface-light, #777);
  white-space: nowrap;
}

.sfsr-match-item__snippet {
  color: var(--b3-theme-on-surface, #444);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.sfsr-match-item__highlight {
  background-color: var(--b3-theme-secondary-light, #ffe58f);
  color: inherit;
  font-weight: 600;
  padding: 0 1px;
  border-radius: 2px;
}
</style>
