<template>
  <div class="sfsr-row sfsr-row--secondary">
    <div class="sfsr-field">
      <input
        ref="replaceInputRef"
        :value="props.replacement"
        class="b3-text-field sfsr-input"
        :disabled="props.replaceInputDisabled"
        :placeholder="t('replacePlaceholder')"
        @compositionstart="props.onReplaceCompositionStart"
        @compositionend="props.onReplaceCompositionEnd"
        @input="props.onReplaceInput"
        @keydown.enter.prevent="props.onReplaceCurrent"
      />
      <div
        v-if="!props.isMobile"
        class="sfsr-field__toggles"
      >
        <button
          :class="optionButtonClass(props.preserveCase)"
          class="sfsr-button"
          :title="t('settingPreserveCaseTitle')"
          @click="props.onTogglePreserveCase"
        >
          Aa*
        </button>
      </div>
    </div>
    <div class="sfsr-row__trailing sfsr-row__trailing--replace">
      <button
        class="sfsr-button sfsr-action"
        :disabled="!props.canReplaceCurrent"
        :title="t('replaceAction')"
        :aria-label="t('replaceAction')"
        @click="props.onReplaceCurrent"
      >
        <svg
          aria-hidden="true"
          class="sfsr-action__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.8"
        >
          <path d="M14 4c0-1.1.9-2 2-2m4 0c1.1 0 2 .9 2 2m0 4c0 1.1-.9 2-2 2m-4 0c-1.1 0-2-.9-2-2M3 7l3 3l3-3" />
          <path d="M6 10V5c0-1.7 1.3-3 3-3h1" />
          <rect width="8" height="8" x="2" y="14" rx="2" />
        </svg>
      </button>
      <button
        class="sfsr-button sfsr-action"
        :disabled="!props.hasMatches"
        :title="t('skipAction')"
        :aria-label="t('skipAction')"
        @click="props.onSkipCurrent"
      >
        <svg
          aria-hidden="true"
          class="sfsr-action__icon sfsr-toolbar-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.8"
        >
          <path d="M4 14c0-3.9 3.1-7 7-7h7" />
          <path d="M15 4l4 3-4 3" />
          <circle cx="9" cy="17" r="1.5" fill="none" stroke="currentColor" stroke-width="1.8" />
        </svg>
      </button>
      <button
        class="sfsr-button sfsr-action"
        :disabled="!props.canReplaceAll"
        :title="t('replaceAllAction')"
        :aria-label="t('replaceAllAction')"
        @click="props.onReplaceAll"
      >
        <svg
          aria-hidden="true"
          class="sfsr-action__icon sfsr-toolbar-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.8"
        >
          <path d="M14 4c0-1.1.9-2 2-2m4 0c1.1 0 2 .9 2 2m0 4c0 1.1-.9 2-2 2m-4 0c-1.1 0-2-.9-2-2M3 7l3 3l3-3" />
          <path d="M6 10V5c0-1.7 1.3-3 3-3h1" />
          <rect width="8" height="8" x="2" y="14" rx="2" />
          <path d="M14 14c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2m6-8c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2" />
        </svg>
      </button>
      <button
        v-if="!props.isMobile"
        class="sfsr-button sfsr-action"
        :disabled="!props.hasMatches"
        :title="t('extractAllAction')"
        :aria-label="t('extractAllAction')"
        @click="props.onExtractAll"
      >
        <svg
          aria-hidden="true"
          class="sfsr-action__icon sfsr-toolbar-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.8"
        >
          <rect width="12" height="13" x="8" y="8" rx="2" />
          <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
          <path d="M11 12h6M11 16h4" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { t } from '@/i18n/runtime'

const props = defineProps<{
  canReplaceAll: boolean
  canReplaceCurrent: boolean
  hasMatches: boolean
  isMobile?: boolean
  onExtractAll: () => void
  onReplaceAll: () => void
  onReplaceCompositionEnd: (event: CompositionEvent) => void
  onReplaceCompositionStart: (event: CompositionEvent) => void
  onReplaceCurrent: () => void
  onReplaceInput: (event: Event) => void
  onSkipCurrent: () => void
  onTogglePreserveCase: () => void
  preserveCase: boolean
  replaceInputDisabled: boolean
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
