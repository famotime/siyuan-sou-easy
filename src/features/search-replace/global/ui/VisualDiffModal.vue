<template>
  <div
    v-if="visible"
    class="sfsr-diff-backdrop"
    @click.self="onCancel"
  >
    <div class="sfsr-diff-modal">
      <div class="sfsr-diff-header">
        <div class="sfsr-diff-title">
          <WireframeIcon
            name="diff"
            :size="15"
          />
          <span>{{ t('globalDiffModalTitle') }}</span>
        </div>
        <button
          class="sfsr-diff-close"
          type="button"
          :aria-label="t('globalDiffClose')"
          @click="onCancel"
        >
          <WireframeIcon
            name="close"
            :size="13"
          />
        </button>
      </div>

      <div class="sfsr-diff-summary-bar">
        <div class="sfsr-diff-stats">
          <span>{{ t('globalDiffTotalLabel') }} <strong>{{ diffSummary.includedCount }}</strong> {{ t('globalDiffCountUnit') }}</span>
          <span class="sfsr-divider">|</span>
          <span>{{ t('globalDiffExcludedLabel') }} <strong>{{ diffSummary.excludedCount }}</strong> {{ t('globalDiffCountUnit') }}</span>
          <span class="sfsr-divider">|</span>
          <span>{{ t('globalDiffAffectedLabel') }} <strong>{{ diffSummary.affectedDocCount }}</strong> {{ t('globalDiffDocUnit') }}</span>
        </div>
        <div class="sfsr-diff-quick-actions">
          <button
            class="sfsr-diff-text-btn"
            type="button"
            @click="toggleIncludeAll(true)"
          >
            {{ t('globalDiffIncludeAll') }}
          </button>
          <button
            class="sfsr-diff-text-btn"
            type="button"
            @click="toggleIncludeAll(false)"
          >
            {{ t('globalDiffExcludeAll') }}
          </button>
          <span class="sfsr-divider">|</span>
          <button
            class="sfsr-diff-text-btn"
            type="button"
            @click="toggleCollapseAll(true)"
          >
            {{ t('globalDiffCollapseAll') }}
          </button>
          <button
            class="sfsr-diff-text-btn"
            type="button"
            @click="toggleCollapseAll(false)"
          >
            {{ t('globalDiffExpandAll') }}
          </button>
        </div>
      </div>

      <div class="sfsr-diff-body">
        <div
          v-for="group in diffSummary.groups"
          :key="group.rootId"
          class="sfsr-diff-group"
          :class="{ 'sfsr-diff-group--collapsed': isGroupCollapsed(group.rootId) }"
        >
          <div
            class="sfsr-diff-group-header"
            @click="toggleGroupCollapse(group.rootId)"
          >
            <div class="sfsr-diff-group-header-left">
              <span
                class="sfsr-diff-group-arrow"
                :class="{ 'sfsr-diff-group-arrow--expanded': !isGroupCollapsed(group.rootId) }"
                :aria-label="t('globalDiffToggleDocAria')"
              >
                <WireframeIcon
                  name="chevron"
                  :size="11"
                />
              </span>

              <label
                class="sfsr-group-checkbox-label"
                @click.stop
              >
                <input
                  type="checkbox"
                  :checked="!group.allExcluded"
                  @change="onToggleGroup(group)"
                >
              </label>

              <WireframeIcon
                name="document"
                :size="13"
                class="sfsr-group-icon"
              />
              <span class="sfsr-group-title">{{ group.docTitle }}</span>
              <span
                v-if="group.hpath"
                class="sfsr-group-path"
              >({{ group.hpath }})</span>
            </div>
            <span class="sfsr-group-count">{{ group.items.length }} {{ t('globalDiffCountUnit') }}</span>
          </div>

          <div
            v-show="!isGroupCollapsed(group.rootId)"
            class="sfsr-diff-items-list"
          >
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

              <DiffComparisonLines
                :prefix-text="item.prefixText"
                :matched-text="item.matchedText"
                :replaced-text="item.replacedText"
                :suffix-text="item.suffixText"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 进度条 -->
      <div
        v-if="executing"
        class="sfsr-diff-progress"
      >
        <div
          class="sfsr-progress-bar"
          :style="{ width: `${progressPercent}%` }"
        />
        <span class="sfsr-progress-text">{{ t('globalDiffProgressPrefix') }} ({{ processedBlocks }} / {{ totalBlocks }})</span>
      </div>

      <div class="sfsr-diff-footer">
        <button
          class="sfsr-btn sfsr-btn--secondary"
          type="button"
          :disabled="executing"
          @click="onCancel"
        >
          {{ t('globalDiffCancelBtn') }}
        </button>
        <button
          class="sfsr-btn sfsr-btn--primary"
          type="button"
          :disabled="executing || diffSummary.includedCount === 0"
          @click="onConfirm"
        >
          {{ executing ? t('globalDiffExecutingBtn') : t('globalDiffConfirmBtn', { count: diffSummary.includedCount }) }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  DiffDocumentGroup,
  DiffItem,
  DiffSummary,
} from '../diff-builder'
import {
  computed,
  watch,
} from 'vue'
import WireframeIcon from '@/components/SiyuanTheme/WireframeIcon.vue'
import { t } from '@/i18n/runtime'
import DiffComparisonLines from './DiffComparisonLines.vue'
import { useToggleSet } from './use-toggle-set'

const props = defineProps<{
  visible: boolean
  diffSummary: DiffSummary
  /** 替换执行中（进度条与按钮状态由父组件驱动，RF-204 由 defineExpose 改造而来） */
  executing?: boolean
  progress?: { processed: number, total: number }
}>()

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'confirm'): void
  (e: 'toggle-item', item: DiffItem): void
  (e: 'toggle-group', group: DiffDocumentGroup): void
  (e: 'toggle-all', include: boolean): void
}>()

const executing = computed(() => props.executing ?? false)
const processedBlocks = computed(() => props.progress?.processed ?? 0)
const totalBlocks = computed(() => props.progress?.total ?? 0)
const collapsedDocIds = useToggleSet()

watch(
  () => props.visible,
  (val) => {
    if (!val) {
      collapsedDocIds.clear()
    }
    // 进度归零由父组件在打开弹窗时重置 progress props（RF-204）
  },
)

function isGroupCollapsed(rootId: string): boolean {
  return collapsedDocIds.has(rootId)
}

function toggleGroupCollapse(rootId: string) {
  collapsedDocIds.toggle(rootId)
}

function toggleCollapseAll(collapse: boolean) {
  collapsedDocIds.toggleAll(props.diffSummary.groups.map((g) => g.rootId), collapse)
}

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
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s ease;
}

.sfsr-diff-group-header:hover {
  background: var(--b3-theme-surface-hover, var(--b3-list-hover, rgba(128, 128, 128, 0.08)));
}

.sfsr-diff-group-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.sfsr-diff-group-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  color: var(--b3-theme-on-surface-light);
  transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}

.sfsr-diff-group-arrow--expanded {
  transform: rotate(90deg);
}

.sfsr-group-checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  margin: 0;
  padding: 0;
}

.sfsr-group-icon {
  color: var(--b3-theme-primary);
  flex-shrink: 0;
}

.sfsr-group-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sfsr-group-path {
  font-size: 11px;
  font-weight: normal;
  color: var(--b3-theme-on-surface-light);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sfsr-group-count {
  font-size: 11px;
  color: var(--b3-theme-primary);
  flex-shrink: 0;
  margin-left: 8px;
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
