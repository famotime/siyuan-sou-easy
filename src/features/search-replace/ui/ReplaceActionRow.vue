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
      <div class="sfsr-field__toggles">
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
      <SyButton
        class="sfsr-action"
        :disabled="!props.canReplaceCurrent"
        :title="t('replaceAction')"
        :aria-label="t('replaceAction')"
        @click="props.onReplaceCurrent"
      >
        <svg
          aria-hidden="true"
          class="sfsr-action__icon"
          viewBox="0 0 24 24"
        >
          <g
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          >
            <path d="M14 4c0-1.1.9-2 2-2m4 0c1.1 0 2 .9 2 2m0 4c0 1.1-.9 2-2 2m-4 0c-1.1 0-2-.9-2-2M3 7l3 3l3-3" />
            <path d="M6 10V5c0-1.7 1.3-3 3-3h1" />
            <rect width="8" height="8" x="2" y="14" rx="2" />
          </g>
        </svg>
      </SyButton>
      <SyButton
        class="sfsr-action"
        :disabled="!props.hasMatches"
        :title="t('skipAction')"
        :aria-label="t('skipAction')"
        @click="props.onSkipCurrent"
      >
        <svg
          aria-hidden="true"
          class="sfsr-action__icon"
          viewBox="0 0 16 16"
        >
          <path
            fill="currentColor"
            d="M10.147 2.146a.5.5 0 0 0 0 .708L12.293 5H9.957c-1.468 0-2.905 0-4.226.396c-1.365.41-2.585 1.234-3.647 2.827a.5.5 0 0 0 .832.554C3.854 7.37 4.884 6.694 6.02 6.354C7.185 6.004 8.483 6 10 6h2.293l-2.146 2.146a.5.5 0 1 0 .707.708l3-3a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.707 0M8 15a2 2 0 1 0 0-4a2 2 0 0 0 0 4m0-1a1 1 0 1 1 0-2a1 1 0 0 1 0 2"
          />
        </svg>
      </SyButton>
      <SyButton
        class="sfsr-action"
        :disabled="!props.canReplaceAll"
        :title="t('replaceAllAction')"
        :aria-label="t('replaceAllAction')"
        @click="props.onReplaceAll"
      >
        <svg
          aria-hidden="true"
          class="sfsr-action__icon"
          viewBox="0 0 24 24"
        >
          <g
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          >
            <path d="M14 4c0-1.1.9-2 2-2m4 0c1.1 0 2 .9 2 2m0 4c0 1.1-.9 2-2 2m-4 0c-1.1 0-2-.9-2-2M3 7l3 3l3-3" />
            <path d="M6 10V5c0-1.7 1.3-3 3-3h1" />
            <rect width="8" height="8" x="2" y="14" rx="2" />
            <path d="M14 14c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2m6-8c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2" />
          </g>
        </svg>
      </SyButton>
      <SyButton
        class="sfsr-action"
        :disabled="!props.hasMatches"
        :title="t('extractAllAction')"
        :aria-label="t('extractAllAction')"
        @click="props.onExtractAll"
      >
        <svg
          aria-hidden="true"
          class="sfsr-action__icon"
          viewBox="0 0 24 24"
        >
          <g
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          >
            <path d="M8 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" />
            <path d="M16 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2" />
          </g>
        </svg>
      </SyButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { t } from '@/i18n/runtime'
import SyButton from '@/components/SiyuanTheme/SyButton.vue'

const props = defineProps<{
  canReplaceAll: boolean
  canReplaceCurrent: boolean
  hasMatches: boolean
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
