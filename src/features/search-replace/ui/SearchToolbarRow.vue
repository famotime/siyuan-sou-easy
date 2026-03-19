<template>
  <div class="sfsr-row">
    <input
      ref="findInputRef"
      :value="props.query"
      class="b3-text-field sfsr-input"
      :placeholder="t('findPlaceholder')"
      @compositionstart="props.onFindCompositionStart"
      @compositionend="props.onFindCompositionEnd"
      @input="props.onFindInput"
      @keydown.enter.prevent="props.onFindEnter"
    />

    <button
      :class="optionButtonClass(props.matchCase)"
      class="sfsr-button"
      :title="t('matchCase')"
      @click="props.onToggleOption('matchCase')"
    >
      Aa
    </button>
    <button
      :class="optionButtonClass(props.wholeWord)"
      class="sfsr-button"
      :title="t('wholeWord')"
      @click="props.onToggleOption('wholeWord')"
    >
      ab
    </button>
    <button
      :class="optionButtonClass(props.useRegex)"
      class="sfsr-button"
      :title="t('useRegex')"
      @click="props.onToggleOption('useRegex')"
    >
      .*
    </button>
    <button
      :class="optionButtonClass(props.selectionOnly)"
      class="sfsr-button sfsr-icon-button"
      :aria-label="t('selectionOnly')"
      :title="t('selectionOnly')"
      @pointerdown.prevent.stop="props.onSelectionOnlyPointerDown"
      @click.stop="props.onSelectionOnlyClick"
    >
      <svg
        aria-hidden="true"
        class="sfsr-toolbar-icon"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.4"
      >
        <path d="M4 2.75H2.75V5" />
        <path d="M12 2.75H13.25V5" />
        <path d="M4 13.25H2.75V11" />
        <path d="M12 13.25H13.25V11" />
        <path d="M5.25 6H10.75" />
        <path d="M5.25 8H10.75" />
        <path d="M5.25 10H8.75" />
      </svg>
    </button>

    <div class="sfsr-count">{{ props.counterText }}</div>

    <button
      class="sfsr-button"
      :title="t('previousMatch')"
      @click="props.onGoPrev"
    >
      ↑
    </button>
    <button
      class="sfsr-button"
      :title="t('nextMatch')"
      @click="props.onGoNext"
    >
      ↓
    </button>
    <button
      class="sfsr-button"
      :title="t('closePanel')"
      @click="props.onClose"
    >
      ×
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { SearchOptions } from '../types'
import { t } from '@/i18n/runtime'

const props = defineProps<{
  counterText: string
  matchCase: boolean
  onClose: () => void
  onFindCompositionEnd: (event: CompositionEvent) => void
  onFindCompositionStart: (event: CompositionEvent) => void
  onFindEnter: (event: KeyboardEvent) => void
  onFindInput: (event: Event) => void
  onGoNext: () => void
  onGoPrev: () => void
  onSelectionOnlyClick: () => void
  onSelectionOnlyPointerDown: () => void
  onToggleOption: (option: keyof SearchOptions) => void
  query: string
  selectionOnly: boolean
  useRegex: boolean
  wholeWord: boolean
}>()

const findInputRef = ref<HTMLInputElement>()

defineExpose({
  focusInput() {
    findInputRef.value?.focus()
  },
  selectInput() {
    findInputRef.value?.select()
  },
})

function optionButtonClass(active: boolean) {
  return {
    'sfsr-button--active': active,
  }
}
</script>
