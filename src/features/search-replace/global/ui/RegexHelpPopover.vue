<template>
  <div class="sfsr-regex-help-popover" @click.stop>
    <div class="sfsr-regex-help-header">
      <div class="sfsr-regex-help-title-wrap">
        <WireframeIcon name="help" :size="13" class="sfsr-regex-help-title-icon" />
        <span class="sfsr-regex-help-title">{{ t('regexHelpPopoverTitle') }}</span>
      </div>
      <button
        class="sfsr-regex-help-close-btn"
        type="button"
        :aria-label="t('closePanel')"
        @click="$emit('close')"
      >
        <WireframeIcon name="close" :size="11" />
      </button>
    </div>

    <div class="sfsr-regex-help-note">
      {{ t('regexHelpPopoverNote') }}
    </div>

    <div class="sfsr-regex-help-list">
      <div
        v-for="(item, idx) in helpItems"
        :key="idx"
        class="sfsr-regex-help-item"
        :title="item.desc"
        @click="$emit('select-example', item.example)"
      >
        <div class="sfsr-regex-help-item-top">
          <span class="sfsr-regex-help-tag">{{ item.tag }}</span>
          <code class="sfsr-regex-help-code">{{ item.example }}</code>
        </div>
        <div class="sfsr-regex-help-desc">
          {{ item.desc }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { t } from '@/i18n/runtime'
import WireframeIcon from '@/components/SiyuanTheme/WireframeIcon.vue'

defineEmits<{
  (e: 'select-example', example: string): void
  (e: 'close'): void
}>()

const helpItems = computed(() => [
  {
    tag: t('regexHelpTagAlternation'),
    example: t('regexHelpPatternAlternation'),
    desc: t('regexHelpDescAlternation'),
  },
  {
    tag: t('regexHelpTagAny'),
    example: t('regexHelpPatternAny'),
    desc: t('regexHelpDescAny'),
  },
  {
    tag: t('regexHelpTagWhitespace'),
    example: t('regexHelpPatternWhitespace'),
    desc: t('regexHelpDescWhitespace'),
  },
  {
    tag: t('regexHelpTagVersion'),
    example: t('regexHelpPatternVersion'),
    desc: t('regexHelpDescVersion'),
  },
])
</script>

<style scoped>
.sfsr-regex-help-popover {
  position: absolute;
  top: 100%;
  margin-top: 4px;
  left: 10px;
  right: 10px;
  width: auto;
  max-width: 310px;
  margin-right: auto;
  z-index: 1000;
  box-sizing: border-box;
  background: var(--b3-theme-surface, #ffffff);
  border: 1px solid var(--b3-theme-surface-lighter, rgba(128, 128, 128, 0.25));
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.16);
  padding: 8px 10px;
  color: var(--b3-theme-on-surface, inherit);
  font-size: 11px;
  line-height: 1.45;
  user-select: none;
  animation: sfsr-popover-fade-in 0.15s ease-out;
}

@keyframes sfsr-popover-fade-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.sfsr-regex-help-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 5px;
  padding-bottom: 5px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter, rgba(128, 128, 128, 0.15));
}

.sfsr-regex-help-title-wrap {
  display: flex;
  align-items: center;
  gap: 5px;
  font-weight: 600;
  color: var(--b3-theme-on-background, inherit);
  min-width: 0;
}

.sfsr-regex-help-title {
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sfsr-regex-help-title-icon {
  color: var(--b3-theme-primary);
  flex-shrink: 0;
}

.sfsr-regex-help-close-btn {
  background: none;
  border: none;
  padding: 2px;
  color: var(--b3-theme-on-surface-light, #888);
  cursor: pointer;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  flex-shrink: 0;
  transition: opacity 0.12s ease;
}

.sfsr-regex-help-close-btn:hover {
  opacity: 1;
  background: var(--b3-theme-surface-lighter, rgba(128, 128, 128, 0.1));
}

.sfsr-regex-help-note {
  font-size: 10px;
  color: var(--b3-theme-on-surface-light, #777);
  margin-bottom: 6px;
  line-height: 1.35;
}

.sfsr-regex-help-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  max-height: 280px;
  overflow-y: auto;
}

.sfsr-regex-help-item {
  padding: 5px 6px;
  border-radius: 5px;
  background: var(--b3-theme-background, rgba(128, 128, 128, 0.04));
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.12s ease;
}

.sfsr-regex-help-item:hover {
  background: var(--b3-theme-primary-lightest, rgba(66, 133, 244, 0.08));
  border-color: var(--b3-theme-primary-light, rgba(66, 133, 244, 0.3));
}

.sfsr-regex-help-item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
  gap: 4px;
  flex-wrap: wrap;
}

.sfsr-regex-help-tag {
  font-size: 9.5px;
  color: var(--b3-theme-primary);
  font-weight: 500;
  flex-shrink: 0;
}

.sfsr-regex-help-code {
  font-family: var(--b3-font-family-code, monospace);
  font-size: 10px;
  background: var(--b3-theme-surface, #fff);
  padding: 1px 4px;
  border-radius: 3px;
  border: 1px solid var(--b3-theme-surface-lighter, rgba(128, 128, 128, 0.18));
  color: var(--b3-theme-on-background, inherit);
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sfsr-regex-help-desc {
  font-size: 9.5px;
  color: var(--b3-theme-on-surface-light, #888);
  line-height: 1.35;
  word-break: break-all;
}
</style>
