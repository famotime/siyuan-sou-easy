<template>
  <div class="sfsr-search-help-popover" @click.stop>
    <div class="sfsr-search-help-header">
      <div class="sfsr-search-help-title-wrap">
        <WireframeIcon name="help" :size="13" class="sfsr-search-help-title-icon" />
        <span class="sfsr-search-help-title">{{ t('searchHelpTitle') }}</span>
      </div>
      <button
        class="sfsr-search-help-close-btn"
        type="button"
        :aria-label="t('closePanel')"
        @click="$emit('close')"
      >
        <WireframeIcon name="close" :size="11" />
      </button>
    </div>

    <div class="sfsr-search-help-note">
      {{ t('searchHelpNote') }}
    </div>

    <div class="sfsr-search-help-list">
      <div
        v-for="(item, idx) in helpItems"
        :key="idx"
        class="sfsr-search-help-item"
        :title="item.desc"
        @click="$emit('select-example', item.example)"
      >
        <div class="sfsr-search-help-item-top">
          <span class="sfsr-search-help-tag">{{ item.tag }}</span>
          <code class="sfsr-search-help-code">{{ item.example }}</code>
        </div>
        <div class="sfsr-search-help-desc">
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
    tag: 'AND 多词',
    example: t('searchHelpExampleAnd'),
    desc: t('searchHelpDescAnd'),
  },
  {
    tag: '短语匹配',
    example: t('searchHelpExamplePhrase'),
    desc: t('searchHelpDescPhrase'),
  },
  {
    tag: '排除词 NOT',
    example: t('searchHelpExampleExclude'),
    desc: t('searchHelpDescExclude'),
  },
  {
    tag: '逻辑或 OR',
    example: t('searchHelpExampleOr'),
    desc: t('searchHelpDescOr'),
  },
  {
    tag: '属性过滤',
    example: t('searchHelpExampleFilter'),
    desc: t('searchHelpDescFilter'),
  },
])
</script>

<style scoped>
.sfsr-search-help-popover {
  position: absolute;
  top: 36px;
  right: 10px;
  left: 10px;
  width: auto;
  max-width: 310px;
  margin-left: auto;
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

.sfsr-search-help-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 5px;
  padding-bottom: 5px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter, rgba(128, 128, 128, 0.15));
}

.sfsr-search-help-title-wrap {
  display: flex;
  align-items: center;
  gap: 5px;
  font-weight: 600;
  color: var(--b3-theme-on-background, inherit);
  min-width: 0;
}

.sfsr-search-help-title {
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sfsr-search-help-title-icon {
  color: var(--b3-theme-primary);
  flex-shrink: 0;
}

.sfsr-search-help-close-btn {
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

.sfsr-search-help-close-btn:hover {
  opacity: 1;
  background: var(--b3-theme-surface-lighter, rgba(128, 128, 128, 0.1));
}

.sfsr-search-help-note {
  font-size: 10px;
  color: var(--b3-theme-on-surface-light, #777);
  margin-bottom: 6px;
  line-height: 1.35;
}

.sfsr-search-help-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  max-height: 280px;
  overflow-y: auto;
}

.sfsr-search-help-item {
  padding: 5px 6px;
  border-radius: 5px;
  background: var(--b3-theme-background, rgba(128, 128, 128, 0.04));
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.12s ease;
}

.sfsr-search-help-item:hover {
  background: var(--b3-theme-primary-lightest, rgba(66, 133, 244, 0.08));
  border-color: var(--b3-theme-primary-light, rgba(66, 133, 244, 0.3));
}

.sfsr-search-help-item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
  gap: 4px;
  flex-wrap: wrap;
}

.sfsr-search-help-tag {
  font-size: 9.5px;
  color: var(--b3-theme-primary);
  font-weight: 500;
  flex-shrink: 0;
}

.sfsr-search-help-code {
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

.sfsr-search-help-desc {
  font-size: 9.5px;
  color: var(--b3-theme-on-surface-light, #888);
  line-height: 1.35;
  word-break: break-all;
}
</style>
