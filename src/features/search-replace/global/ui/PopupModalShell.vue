<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="sfsr-popup-backdrop"
      @click.self="$emit('close')"
    >
      <div
        class="sfsr-popup-modal"
        :class="modalClass"
      >
        <div class="sfsr-popup-header">
          <span class="sfsr-popup-title-wrap">
            <WireframeIcon
              :name="icon"
              :size="14"
            />
            <span>{{ title }}</span>
          </span>
          <button
            class="sfsr-popup-close"
            type="button"
            aria-label="关闭弹窗"
            @click="$emit('close')"
          >
            <WireframeIcon
              name="close"
              :size="13"
            />
          </button>
        </div>
        <div class="sfsr-popup-body">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// 拆分自 GlobalSearchDockView.vue（RF-107）：导出/预设弹窗共用的
// 遮罩 + 标题栏 + 关闭按钮 + 内容插槽外壳。
import WireframeIcon from '@/components/SiyuanTheme/WireframeIcon.vue'

defineProps<{
  visible: boolean
  icon: string
  title: string
  modalClass?: string
}>()

defineEmits<{
  (e: 'close'): void
}>()
</script>

<style scoped>
.sfsr-popup-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: var(--b3-mask-background, rgba(0, 0, 0, 0.48));
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10003;
}

.sfsr-popup-modal {
  width: 340px;
  max-width: 90vw;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  box-shadow: var(--b3-dialog-shadow, 0 8px 24px rgba(0, 0, 0, 0.2));
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sfsr-popup-modal--presets {
  width: 400px;
}

.sfsr-popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.15));
  font-weight: 600;
  font-size: 13px;
}

.sfsr-popup-title-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--b3-theme-primary);
}

.sfsr-popup-close {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  color: var(--b3-theme-on-surface-light);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.sfsr-popup-close:hover {
  color: var(--b3-theme-on-background);
}

.sfsr-popup-body {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
