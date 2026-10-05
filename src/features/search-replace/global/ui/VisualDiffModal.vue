<template>
  <div v-if="visible" class="sfsr-diff-backdrop" @click.self="onCancel">
    <div class="sfsr-diff-modal">
      <div class="sfsr-diff-header">
        <div class="sfsr-diff-title">
          <WireframeIcon name="diff" :size="15" />
          <span>批量替换变更对比 (Visual Diff)</span>
        </div>
        <button class="sfsr-diff-close" type="button" aria-label="关闭对比视窗" @click="onCancel">
          <WireframeIcon name="close" :size="13" />
        </button>
      </div>

      <div class="sfsr-diff-summary-bar">
        <div class="sfsr-diff-stats">
          <span>总计待替换: <strong>{{ diffSummary.includedCount }}</strong> 处</span>
          <span class="sfsr-divider">|</span>
          <span>已排除: <strong>{{ diffSummary.excludedCount }}</strong> 处</span>
          <span class="sfsr-divider">|</span>
          <span>受影响文档: <strong>{{ diffSummary.affectedDocCount }}</strong> 篇</span>
        </div>
        <div class="sfsr-diff-quick-actions">
          <button class="sfsr-diff-text-btn" type="button" @click="toggleIncludeAll(true)">全部包含</button>
          <button class="sfsr-diff-text-btn" type="button" @click="toggleIncludeAll(false)">全部排除</button>
        </div>
      </div>

      <div class="sfsr-diff-body">
        <div
          v-for="group in diffSummary.groups"
          :key="group.rootId"
          class="sfsr-diff-group"
        >
          <div class="sfsr-diff-group-header">
            <label class="sfsr-group-checkbox-label">
              <input
                type="checkbox"
                :checked="!group.allExcluded"
                @change="onToggleGroup(group)"
              >
              <WireframeIcon name="document" :size="13" class="sfsr-group-icon" />
              <span class="sfsr-group-title">{{ group.docTitle }}</span>
              <span class="sfsr-group-path">({{ group.hpath }})</span>
            </label>
            <span class="sfsr-group-count">{{ group.items.length }} 处</span>
          </div>

          <div class="sfsr-diff-items-list">
            <div
              v-for="item in group.items"
              :key="item.matchId"
              class="sfsr-diff-item"
              :class="{ 'sfsr-diff-item--excluded': item.excluded }"
            >
              <input
                type="checkbox"
                :checked="!item.excluded"
                class="sfsr-item-checkbox"
                @change="onToggleItem(item)"
              >

              <div class="sfsr-diff-comparison">
                <div class="sfsr-diff-line sfsr-diff-line--before">
                  <span class="sfsr-diff-badge sfsr-diff-badge--del">- 原文</span>
                  <span class="sfsr-diff-text">
                    {{ item.prefixText }}<del class="sfsr-del-highlight">{{ item.matchedText }}</del>{{ item.suffixText }}
                  </span>
                </div>
                <div class="sfsr-diff-line sfsr-diff-line--after">
                  <span class="sfsr-diff-badge sfsr-diff-badge--ins">+ 替换</span>
                  <span class="sfsr-diff-text">
                    {{ item.prefixText }}<ins class="sfsr-ins-highlight">{{ item.replacedText }}</ins>{{ item.suffixText }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 进度条 -->
      <div v-if="executing" class="sfsr-diff-progress">
        <div class="sfsr-progress-bar" :style="{ width: `${progressPercent}%` }" />
        <span class="sfsr-progress-text">正在安全执行替换... ({{ processedBlocks }} / {{ totalBlocks }})</span>
      </div>

      <div class="sfsr-diff-footer">
        <button class="sfsr-btn sfsr-btn--secondary" type="button" :disabled="executing" @click="onCancel">
          取消
        </button>
        <button
          class="sfsr-btn sfsr-btn--primary"
          type="button"
          :disabled="executing || diffSummary.includedCount === 0"
          @click="onConfirm"
        >
          {{ executing ? '替换中...' : `确认执行替换 (${diffSummary.includedCount} 处)` }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DiffDocumentGroup, DiffItem, DiffSummary } from '../diff-builder'
import WireframeIcon from '@/components/SiyuanTheme/WireframeIcon.vue'

const props = defineProps<{
  visible: boolean
  diffSummary: DiffSummary
}>()

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'confirm'): void
  (e: 'toggle-item', item: DiffItem): void
  (e: 'toggle-group', group: DiffDocumentGroup): void
  (e: 'toggle-all', include: boolean): void
}>()

const executing = ref(false)
const processedBlocks = ref(0)
const totalBlocks = ref(0)

const progressPercent = computed(() => {
  if (totalBlocks.value === 0) return 0
  return Math.min(100, Math.round((processedBlocks.value / totalBlocks.value) * 100))
})

function onCancel() {
  if (!executing.value) {
    emit('cancel')
  }
}

function onConfirm() {
  emit('confirm')
}

function onToggleItem(item: DiffItem) {
  emit('toggle-item', item)
}

function onToggleGroup(group: DiffDocumentGroup) {
  emit('toggle-group', group)
}

function toggleIncludeAll(include: boolean) {
  emit('toggle-all', include)
}

defineExpose({
  setExecuting(isExecuting: boolean) {
    executing.value = isExecuting
  },
  setProgress(processed: number, total: number) {
    processedBlocks.value = processed
    totalBlocks.value = total
  },
  setExecutionState(isExecuting: boolean, processed = 0, total = 0) {
    executing.value = isExecuting
    processedBlocks.value = processed
    totalBlocks.value = total
  },
})
</script>

<style scoped>
.sfsr-diff-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: var(--b3-mask-background, rgba(0, 0, 0, 0.48));
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10001;
}

.sfsr-diff-modal {
  width: 820px;
  max-width: 94vw;
  max-height: 85vh;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  box-shadow: var(--b3-dialog-shadow, 0 16px 40px rgba(0, 0, 0, 0.3));
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sfsr-diff-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 18px;
  border-bottom: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.2));
}

.sfsr-diff-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  color: var(--b3-theme-primary);
}

.sfsr-diff-close {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  color: var(--b3-theme-on-surface-light);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.sfsr-diff-close:hover {
  color: var(--b3-theme-on-background);
}

.sfsr-diff-summary-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 18px;
  background: var(--b3-theme-surface, transparent);
  border-bottom: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.15));
  font-size: 12px;
}

.sfsr-diff-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--b3-theme-on-surface);
}

.sfsr-divider {
  color: var(--b3-border-color, rgba(128, 128, 128, 0.3));
}

.sfsr-diff-quick-actions {
  display: flex;
  gap: 8px;
}

.sfsr-diff-text-btn {
  background: none;
  border: none;
  color: var(--b3-theme-primary);
  cursor: pointer;
  font-size: 12px;
}

.sfsr-diff-text-btn:hover {
  text-decoration: underline;
}

.sfsr-diff-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 18px;
  max-height: 56vh;
}

.sfsr-diff-group {
  margin-bottom: 14px;
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.2));
  border-radius: 6px;
  overflow: hidden;
}

.sfsr-diff-group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: var(--b3-theme-surface, rgba(128, 128, 128, 0.05));
  font-size: 13px;
  font-weight: 600;
}

.sfsr-group-checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.sfsr-group-icon {
  color: var(--b3-theme-primary);
}

.sfsr-group-path {
  font-size: 11px;
  font-weight: normal;
  color: var(--b3-theme-on-surface-light);
}

.sfsr-group-count {
  font-size: 11px;
  color: var(--b3-theme-primary);
}

.sfsr-diff-items-list {
  display: flex;
  flex-direction: column;
}

.sfsr-diff-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border-top: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.1));
  font-size: 12px;
  line-height: 1.5;
  transition: opacity 0.15s ease;
}

.sfsr-diff-item--excluded {
  opacity: 0.45;
}

.sfsr-item-checkbox {
  margin-top: 4px;
  cursor: pointer;
}

.sfsr-diff-comparison {
  flex: 1;
}

.sfsr-diff-line {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.sfsr-diff-line--before {
  color: var(--b3-theme-on-surface);
}

.sfsr-diff-line--after {
  color: var(--b3-theme-on-surface);
  margin-top: 2px;
}

.sfsr-diff-badge {
  font-size: 10px;
  padding: 0 4px;
  border-radius: 3px;
  font-weight: bold;
}

.sfsr-diff-badge--del {
  background: var(--sfsr-diff-del-bg, rgba(245, 34, 45, 0.15));
  color: var(--sfsr-diff-del-text, #f5222d);
}

.sfsr-diff-badge--ins {
  background: var(--sfsr-diff-ins-bg, rgba(82, 196, 26, 0.15));
  color: var(--sfsr-diff-ins-text, #52c41a);
}

.sfsr-del-highlight {
  background: var(--sfsr-diff-del-highlight, rgba(245, 34, 45, 0.25));
  color: var(--sfsr-diff-del-text, #f5222d);
  text-decoration: line-through;
  padding: 0 2px;
  border-radius: 2px;
}

.sfsr-ins-highlight {
  background: var(--sfsr-diff-ins-highlight, rgba(82, 196, 26, 0.25));
  color: var(--sfsr-diff-ins-text, #52c41a);
  text-decoration: underline;
  padding: 0 2px;
  font-weight: 600;
  border-radius: 2px;
}

.sfsr-diff-progress {
  position: relative;
  height: 22px;
  background: var(--b3-theme-surface-lighter, rgba(128, 128, 128, 0.1));
  display: flex;
  align-items: center;
  justify-content: center;
}

.sfsr-progress-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: var(--b3-theme-primary);
  transition: width 0.15s ease;
}

.sfsr-progress-text {
  position: relative;
  font-size: 11px;
  color: var(--b3-theme-on-background);
  font-weight: 500;
}

.sfsr-diff-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 10px 18px;
  border-top: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.15));
}

.sfsr-btn {
  height: 30px;
  padding: 0 14px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.15s ease;
}

.sfsr-btn--secondary {
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.3));
  background: var(--b3-theme-surface, transparent);
  color: var(--b3-theme-on-surface);
}

.sfsr-btn--secondary:hover {
  background: var(--b3-theme-surface-hover, var(--b3-list-hover, rgba(128, 128, 128, 0.08)));
}

.sfsr-btn--primary {
  background: var(--b3-theme-primary);
  color: #fff;
  border: none;
}

.sfsr-btn--primary:hover:not(:disabled) {
  opacity: 0.9;
}

.sfsr-btn--primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
