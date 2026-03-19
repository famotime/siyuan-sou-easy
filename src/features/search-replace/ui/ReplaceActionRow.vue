<template>
  <div class="sfsr-row sfsr-row--secondary">
    <input
      ref="replaceInputRef"
      :value="props.replacement"
      class="b3-text-field sfsr-input"
      :placeholder="t('replacePlaceholder')"
      @compositionstart="props.onReplaceCompositionStart"
      @compositionend="props.onReplaceCompositionEnd"
      @input="props.onReplaceInput"
      @keydown.enter.prevent="props.onReplaceCurrent"
    />
    <button
      :class="optionButtonClass(props.preserveCase)"
      class="sfsr-button"
      :title="t('settingPreserveCaseTitle')"
      @click="props.onTogglePreserveCase"
    >
      Aa*
    </button>
    <SyButton
      class="sfsr-action"
      :disabled="!props.canReplaceCurrent"
      @click="props.onReplaceCurrent"
    >
      {{ t('replaceAction') }}
    </SyButton>
    <SyButton
      class="sfsr-action"
      :disabled="!props.hasMatches"
      @click="props.onSkipCurrent"
    >
      {{ t('skipAction') }}
    </SyButton>
    <SyButton
      class="sfsr-action"
      :disabled="!props.hasMatches"
      @click="props.onReplaceAll"
    >
      {{ t('replaceAllAction') }}
    </SyButton>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { t } from '@/i18n/runtime'
import SyButton from '@/components/SiyuanTheme/SyButton.vue'

const props = defineProps<{
  canReplaceCurrent: boolean
  hasMatches: boolean
  onReplaceAll: () => void
  onReplaceCompositionEnd: (event: CompositionEvent) => void
  onReplaceCompositionStart: (event: CompositionEvent) => void
  onReplaceCurrent: () => void
  onReplaceInput: (event: Event) => void
  onSkipCurrent: () => void
  onTogglePreserveCase: () => void
  preserveCase: boolean
  replacement: string
}>()

const replaceInputRef = ref<HTMLInputElement>()

defineExpose({
  focusInput() {
    replaceInputRef.value?.focus()
  },
})

function optionButtonClass(active: boolean) {
  return {
    'sfsr-button--active': active,
  }
}
</script>
