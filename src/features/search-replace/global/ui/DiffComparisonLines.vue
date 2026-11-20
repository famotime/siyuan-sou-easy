<template>
  <div class="sfsr-diff-comparison">
    <div class="sfsr-diff-line sfsr-diff-line--before">
      <span class="sfsr-diff-badge sfsr-diff-badge--del">{{ t('globalDiffBadgeDel') }}</span>
      <span class="sfsr-diff-text">
        {{ prefixText }}<del class="sfsr-del-highlight">{{ matchedText }}</del>{{ suffixText }}
      </span>
    </div>
    <div class="sfsr-diff-line sfsr-diff-line--after">
      <span class="sfsr-diff-badge sfsr-diff-badge--ins">{{ t('globalDiffBadgeIns') }}</span>
      <span class="sfsr-diff-text">
        {{ prefixText }}<ins class="sfsr-ins-highlight">{{ replacedText }}</ins>{{ suffixText }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
// 拆分自 VisualDiffModal.vue / ReplaceHistoryTabView.vue（RF-113）：
// 两处逐字重复的「- 原文 / + 替换」对比行模板与样式。
// 回退逻辑（如 matchedText || tx.query）由调用方解析后传入。
import { t } from '@/i18n/runtime'

defineProps<{
  matchedText: string
  prefixText: string
  replacedText: string
  suffixText: string
}>()
</script>

<style scoped>
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
</style>
