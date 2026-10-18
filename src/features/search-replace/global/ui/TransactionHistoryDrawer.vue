<template>
  <div v-if="visible" class="sfsr-history-backdrop" @click.self="onClose">
    <div class="sfsr-history-drawer">
      <div class="sfsr-history-header">
        <div class="sfsr-history-title-wrap">
          <WireframeIcon name="history" :size="15" />
          <span class="sfsr-history-title">替换事务历史与回退管理</span>
        </div>
        <button class="sfsr-history-close" type="button" aria-label="关闭历史抽屉" @click="onClose">
          <WireframeIcon name="close" :size="13" />
        </button>
      </div>

      <div class="sfsr-history-list">
        <div v-if="transactions.length === 0" class="sfsr-history-empty">
          暂无批量替换历史记录
        </div>

        <div
          v-for="tx in transactions"
          :key="tx.id"
          class="sfsr-history-card"
          :class="{
            'sfsr-history-card--reverted': tx.reverted,
            'sfsr-history-card--expanded': isTxExpanded(tx.id),
          }"
        >
          <!-- 卡片头部概览栏（点击展开/折叠明细） -->
          <div class="sfsr-history-card-header" @click="toggleTxExpand(tx.id)">
            <div class="sfsr-tx-info">
              <div class="sfsr-tx-title">
                <span
                  class="sfsr-tx-expand-arrow"
                  :class="{ 'sfsr-tx-expand-arrow--expanded': isTxExpanded(tx.id) }"
                  aria-label="展开或收起明细"
                >
                  <WireframeIcon name="chevron" :size="11" />
                </span>
                <span class="sfsr-tx-query">“{{ tx.query }}”</span>
                <span class="sfsr-tx-arrow">
                  <WireframeIcon name="chevron-right" :size="11" />
                </span>
                <span class="sfsr-tx-repl">“{{ tx.replacement }}”</span>
              </div>
              <div class="sfsr-tx-meta">
                <span>时间: {{ tx.formattedTime }}</span>
                <span class="sfsr-divider">|</span>
                <span>替换项: {{ tx.itemCount }} 处</span>
                <span class="sfsr-divider">|</span>
                <span class="sfsr-tx-toggle-hint">{{ isTxExpanded(tx.id) ? '收起明细' : '查看明细' }}</span>
              </div>
            </div>

            <div class="sfsr-tx-actions" @click.stop>
              <span v-if="tx.reverted" class="sfsr-reverted-tag">已回滚</span>
              <button
                v-else
                class="sfsr-revert-btn"
                type="button"
                :disabled="revertingId === tx.id"
                @click="onRevert(tx.id)"
              >
                {{ revertingId === tx.id ? '回滚中...' : '一键回退' }}
              </button>
            </div>
          </div>

          <!-- 卡片展开的 Visual Diff 详细对比列表 -->
          <div v-if="isTxExpanded(tx.id)" class="sfsr-history-card-body">
            <div v-if="!tx.items || tx.items.length === 0" class="sfsr-history-no-details">
              无明细数据
            </div>
            <div
              v-for="group in getTxDocGroups(tx)"
              :key="group.rootId"
              class="sfsr-history-doc-group"
              :class="{ 'sfsr-history-doc-group--collapsed': isDocCollapsed(tx.id, group.rootId) }"
            >
              <!-- 文档分组标题栏（支持单独折叠/展开） -->
              <div class="sfsr-history-doc-header" @click="toggleDocCollapse(tx.id, group.rootId)">
                <div class="sfsr-history-doc-header-left">
                  <span
                    class="sfsr-history-doc-arrow"
                    :class="{ 'sfsr-history-doc-arrow--expanded': !isDocCollapsed(tx.id, group.rootId) }"
                    aria-label="折叠或展开文档"
                  >
                    <WireframeIcon name="chevron" :size="10" />
                  </span>
                  <WireframeIcon name="document" :size="12" class="sfsr-history-doc-icon" />
                  <span class="sfsr-history-doc-title">{{ group.docTitle }}</span>
                  <span v-if="group.hpath" class="sfsr-history-doc-path">({{ group.hpath }})</span>
                </div>
                <span class="sfsr-history-doc-count">{{ group.items.length }} 处</span>
              </div>

              <!-- 文档下的段落对比项列表 -->
              <div v-show="!isDocCollapsed(tx.id, group.rootId)" class="sfsr-history-doc-items">
                <div
                  v-for="(item, idx) in group.items"
                  :key="`${item.blockId}_${idx}`"
                  class="sfsr-history-diff-item"
                  @click="onNavigateToItem(item)"
                >
                  <div class="sfsr-diff-comparison">
                    <div class="sfsr-diff-line sfsr-diff-line--before">
                      <span class="sfsr-diff-badge sfsr-diff-badge--del">- 原文</span>
                      <span class="sfsr-diff-text">
                        {{ item.prefixText || '' }}<del class="sfsr-del-highlight">{{ item.matchedText || tx.query }}</del>{{ item.suffixText || '' }}
                      </span>
                    </div>
                    <div class="sfsr-diff-line sfsr-diff-line--after">
                      <span class="sfsr-diff-badge sfsr-diff-badge--ins">+ 替换</span>
                      <span class="sfsr-diff-text">
                        {{ item.prefixText || '' }}<ins class="sfsr-ins-highlight">{{ item.replacedText || tx.replacement }}</ins>{{ item.suffixText || '' }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { ReplaceTransaction, ReplaceTransactionItem } from '../transaction-history'
import { navigateToBlock, revertTransaction } from '../transaction-history'
import WireframeIcon from '@/components/SiyuanTheme/WireframeIcon.vue'

interface HistoryDocGroup {
  rootId: string
  docTitle: string
  hpath: string
  items: ReplaceTransactionItem[]
}

const props = defineProps<{
  visible: boolean
  transactions: ReplaceTransaction[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'reverted', txId: string): void
}>()

const revertingId = ref<string | null>(null)
const expandedTxIds = ref<Set<string>>(new Set())
const collapsedDocKeys = ref<Set<string>>(new Set())

function onClose() {
  emit('close')
}

function toggleTxExpand(txId: string) {
  const next = new Set(expandedTxIds.value)
  if (next.has(txId)) {
    next.delete(txId)
  } else {
    next.add(txId)
  }
  expandedTxIds.value = next
}

function isTxExpanded(txId: string): boolean {
  return expandedTxIds.value.has(txId)
}

function toggleDocCollapse(txId: string, rootId: string) {
  const key = `${txId}:${rootId}`
  const next = new Set(collapsedDocKeys.value)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  collapsedDocKeys.value = next
}

function isDocCollapsed(txId: string, rootId: string): boolean {
  return collapsedDocKeys.value.has(`${txId}:${rootId}`)
}

function getTxDocGroups(tx: ReplaceTransaction): HistoryDocGroup[] {
  const groups: HistoryDocGroup[] = []
  const groupMap = new Map<string, HistoryDocGroup>()

  for (const item of tx.items) {
    const rootId = item.rootId || 'unknown'
    let group = groupMap.get(rootId)
    if (!group) {
      group = {
        rootId,
        docTitle: item.docTitle || '未知文档',
        hpath: item.hpath || '',
        items: [],
      }
      groupMap.set(rootId, group)
      groups.push(group)
    }
    group.items.push(item)
  }

  return groups
}

async function onRevert(txId: string) {
  revertingId.value = txId
  try {
    const res = await revertTransaction(txId)
    if (res.success) {
      emit('reverted', txId)
    } else {
      alert(res.error || '回退失败')
    }
  } finally {
    revertingId.value = null
  }
}

function onNavigateToItem(item: ReplaceTransactionItem) {
  if (item.blockId) {
    navigateToBlock(item.blockId)
  }
}
</script>

<style scoped>
.sfsr-history-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: var(--b3-mask-background, rgba(0, 0, 0, 0.48));
  display: flex;
  justify-content: flex-end;
  z-index: 10002;
}

.sfsr-history-drawer {
  width: 580px;
  max-width: 92vw;
  height: 100vh;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  border-left: 1px solid var(--b3-border-color);
  box-shadow: var(--b3-dialog-shadow, -4px 0 16px rgba(0, 0, 0, 0.2));
  display: flex;
  flex-direction: column;
}

.sfsr-history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.15));
}

.sfsr-history-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--b3-theme-primary);
}

.sfsr-history-title {
  font-weight: 600;
  font-size: 13px;
}

.sfsr-history-close {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  color: var(--b3-theme-on-surface-light);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.sfsr-history-close:hover {
  color: var(--b3-theme-on-background);
}

.sfsr-history-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sfsr-history-empty {
  text-align: center;
  color: var(--b3-theme-on-surface-light);
  font-size: 13px;
  margin-top: 60px;
}

.sfsr-history-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.2));
  border-radius: 6px;
  background: var(--b3-theme-surface, transparent);
  transition: all 0.15s ease;
  overflow: hidden;
}

.sfsr-history-card--reverted {
  opacity: 0.7;
  background: var(--b3-theme-surface-lighter, rgba(128, 128, 128, 0.05));
}

.sfsr-history-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s ease;
}

.sfsr-history-card-header:hover {
  background: var(--b3-theme-surface-hover, var(--b3-list-hover, rgba(128, 128, 128, 0.08)));
}

.sfsr-tx-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.sfsr-tx-title {
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 5px;
}

.sfsr-tx-expand-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  color: var(--b3-theme-on-surface-light);
  transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}

.sfsr-tx-expand-arrow--expanded {
  transform: rotate(90deg);
}

.sfsr-tx-query {
  color: var(--sfsr-diff-del-text, var(--b3-theme-error, #f5222d));
}

.sfsr-tx-arrow {
  display: inline-flex;
  align-items: center;
  color: var(--b3-theme-on-surface-light);
}

.sfsr-tx-repl {
  color: var(--sfsr-diff-ins-text, var(--b3-theme-success, #52c41a));
}

.sfsr-tx-meta {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  display: flex;
  align-items: center;
  gap: 6px;
}

.sfsr-tx-toggle-hint {
  color: var(--b3-theme-primary);
  font-weight: 500;
}

.sfsr-divider {
  color: var(--b3-border-color, rgba(128, 128, 128, 0.3));
}

.sfsr-revert-btn {
  padding: 4px 10px;
  background: var(--b3-theme-warning, #fa8c16);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: opacity 0.15s ease;
  flex-shrink: 0;
}

.sfsr-revert-btn:hover {
  opacity: 0.9;
}

.sfsr-revert-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sfsr-reverted-tag {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--b3-theme-surface-lighter, rgba(128, 128, 128, 0.12));
}

/* 明细区域 */
.sfsr-history-card-body {
  border-top: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.15));
  padding: 8px 10px;
  background: var(--b3-theme-background);
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 480px;
  overflow-y: auto;
}

.sfsr-history-no-details {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  padding: 8px 4px;
  text-align: center;
}

.sfsr-history-doc-group {
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.15));
  border-radius: 5px;
  overflow: hidden;
}

.sfsr-history-doc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 8px;
  background: var(--b3-theme-surface, rgba(128, 128, 128, 0.05));
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s ease;
}

.sfsr-history-doc-header:hover {
  background: var(--b3-theme-surface-hover, var(--b3-list-hover, rgba(128, 128, 128, 0.08)));
}

.sfsr-history-doc-header-left {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 1;
  min-width: 0;
}

.sfsr-history-doc-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  color: var(--b3-theme-on-surface-light);
  transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}

.sfsr-history-doc-arrow--expanded {
  transform: rotate(90deg);
}

.sfsr-history-doc-icon {
  color: var(--b3-theme-primary);
  flex-shrink: 0;
}

.sfsr-history-doc-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sfsr-history-doc-path {
  font-size: 10px;
  font-weight: normal;
  color: var(--b3-theme-on-surface-light);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sfsr-history-doc-count {
  font-size: 10px;
  color: var(--b3-theme-primary);
  flex-shrink: 0;
  margin-left: 6px;
}

.sfsr-history-doc-items {
  display: flex;
  flex-direction: column;
}

.sfsr-history-diff-item {
  padding: 6px 8px;
  border-top: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.08));
  font-size: 11px;
  line-height: 1.5;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.sfsr-history-diff-item:hover {
  background: var(--b3-theme-surface-hover, var(--b3-list-hover, rgba(128, 128, 128, 0.08)));
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
  font-size: 9px;
  padding: 0 4px;
  border-radius: 3px;
  font-weight: bold;
  flex-shrink: 0;
}

.sfsr-diff-badge--del {
  background: var(--sfsr-diff-del-bg, rgba(245, 34, 45, 0.15));
  color: var(--sfsr-diff-del-text, #f5222d);
}

.sfsr-diff-badge--ins {
  background: var(--sfsr-diff-ins-bg, rgba(82, 196, 26, 0.15));
  color: var(--sfsr-diff-ins-text, #52c41a);
}

.sfsr-diff-text {
  word-break: break-all;
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
