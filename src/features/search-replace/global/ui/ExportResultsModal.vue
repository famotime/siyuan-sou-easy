<template>
  <PopupModalShell
    :visible="visible"
    icon="export"
    :title="t('globalExportModalTitle')"
    @close="$emit('close')"
  >
    <button
      class="sfsr-popup-btn"
      type="button"
      @click="onExportMarkdown"
    >
      <WireframeIcon
        name="document"
        :size="13"
      />
      <span>{{ t('globalExportMarkdown') }}</span>
    </button>
    <button
      class="sfsr-popup-btn"
      type="button"
      @click="onExportBlockRefs"
    >
      <WireframeIcon
        name="link"
        :size="13"
      />
      <span>{{ t('globalExportBlockRefs') }}</span>
    </button>
    <button
      class="sfsr-popup-btn"
      type="button"
      @click="onExportEmbedSql"
    >
      <WireframeIcon
        name="code"
        :size="13"
      />
      <span>{{ t('globalExportEmbedSql') }}</span>
    </button>
  </PopupModalShell>
</template>

<script setup lang="ts">
import WireframeIcon from '@/components/SiyuanTheme/WireframeIcon.vue'
import { t } from '@/i18n/runtime'
// 拆分自 GlobalSearchDockView.vue（RF-107）：批量导出弹窗。
// 导出结果写回全局 state.statusMessage 的行为与原实现保持一致。
import {
  copyToClipboard,
  exportAsBlockRefs,
  exportAsEmbedQuery,
  exportAsMarkdownLinks,
} from '../export-utils'
import { globalSearchState } from '../store'
import PopupModalShell from './PopupModalShell.vue'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

function getActiveExportQuery(): string {
  return globalSearchState.searchedQuery.trim() || globalSearchState.query.trim()
}

async function onExportMarkdown() {
  const content = exportAsMarkdownLinks(globalSearchState.results, getActiveExportQuery())
  const ok = await copyToClipboard(content)
  emit('close')
  if (ok) {
    globalSearchState.statusMessage = t('globalExportCopiedMarkdown')
  }
}

async function onExportBlockRefs() {
  const content = exportAsBlockRefs(globalSearchState.results, getActiveExportQuery())
  const ok = await copyToClipboard(content)
  emit('close')
  if (ok) {
    globalSearchState.statusMessage = t('globalExportCopiedBlockRefs')
  }
}

async function onExportEmbedSql() {
  const content = exportAsEmbedQuery(globalSearchState.results)
  const ok = await copyToClipboard(content)
  emit('close')
  if (ok) {
    globalSearchState.statusMessage = t('globalExportCopiedEmbedSql')
  }
}
</script>

<style scoped>
.sfsr-popup-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.15));
  background: var(--b3-theme-surface, transparent);
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s ease;
}

.sfsr-popup-btn:hover {
  background: var(--b3-theme-surface-hover, var(--b3-list-hover, rgba(128, 128, 128, 0.08)));
  border-color: var(--b3-theme-primary);
  color: var(--b3-theme-on-background);
}
</style>
