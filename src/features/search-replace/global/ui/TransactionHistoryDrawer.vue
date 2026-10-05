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
          :class="{ 'sfsr-history-card--reverted': tx.reverted }"
        >
          <div class="sfsr-tx-info">
            <div class="sfsr-tx-title">
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
            </div>
          </div>

          <div class="sfsr-tx-actions">
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { ReplaceTransaction } from '../transaction-history'
import { revertTransaction } from '../transaction-history'
import WireframeIcon from '@/components/SiyuanTheme/WireframeIcon.vue'

const props = defineProps<{
  visible: boolean
  transactions: ReplaceTransaction[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'reverted', txId: string): void
}>()

const revertingId = ref<string | null>(null)

function onClose() {
  emit('close')
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
  width: 440px;
  max-width: 90vw;
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
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.2));
  border-radius: 6px;
  background: var(--b3-theme-surface, transparent);
  transition: all 0.15s ease;
}

.sfsr-history-card--reverted {
  opacity: 0.55;
  background: var(--b3-theme-surface-lighter, rgba(128, 128, 128, 0.08));
}

.sfsr-tx-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sfsr-tx-title {
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
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
</style>
