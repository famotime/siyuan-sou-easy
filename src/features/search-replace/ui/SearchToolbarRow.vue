<template>
  <div class="sfsr-row">
    <div class="sfsr-field">
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

      <div
        v-if="!props.isMobile"
        class="sfsr-field__toggles"
      >
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
          class="sfsr-button sfsr-icon-button sfsr-icon-button--wide sfsr-icon-button--compact"
          :title="t('wholeWord')"
          @click="props.onToggleOption('wholeWord')"
        >
          <svg
            aria-hidden="true"
            class="sfsr-toolbar-icon sfsr-toolbar-icon--whole-word sfsr-toolbar-icon--whole-word-wide"
            viewBox="0 0 22 18"
          >
            <path
              class="sfsr-toolbar-icon-boundary"
              d="M2.6 3.2V14.8M2.6 3.2H4.9M2.6 14.8H4.9"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.35"
            />
            <path
              class="sfsr-toolbar-icon-boundary"
              d="M19.4 3.2V14.8M17.1 3.2H19.4M17.1 14.8H19.4"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.35"
            />
            <text
              class="sfsr-toolbar-icon-word"
              x="11"
              y="10.35"
              text-anchor="middle"
            >ab</text>
            <path
              d="M7.25 13.2H14.75"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-width="1.15"
            />
          </svg>
        </button>
        <button
          :class="optionButtonClass(props.useRegex)"
          class="sfsr-button"
          :title="t('useRegex')"
          @click="props.onToggleOption('useRegex')"
        >
          .*
        </button>
      </div>
    </div>

    <div class="sfsr-row__trailing">
      <div class="sfsr-count">
        <input
          ref="indexInputRef"
          type="text"
          class="b3-text-field sfsr-count__input"
          :value="displayIndex"
          :disabled="props.totalMatches === 0"
          @focus="onIndexFocus"
          @input="onIndexInput"
          @keydown.enter.prevent="onIndexEnter"
          @keydown.esc.stop.prevent="onIndexEsc"
          @blur="onIndexBlur"
        />
        <span class="sfsr-count__total">/ {{ props.totalMatches }}</span>
      </div>

      <button
        class="sfsr-button sfsr-action"
        :title="t('previousMatch')"
        :aria-label="t('previousMatch')"
        @click="props.onGoPrev"
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
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>
      <button
        class="sfsr-button sfsr-action"
        :title="t('nextMatch')"
        :aria-label="t('nextMatch')"
        @click="props.onGoNext"
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
          <path d="M12 5v14M5 12l7 7 7-7" />
        </svg>
      </button>
      <button
        v-if="!props.isMobile"
        :class="optionButtonClass(props.selectionOnly)"
        class="sfsr-button sfsr-action"
        :aria-label="t('selectionOnly')"
        :title="t('selectionOnly')"
        @pointerdown.prevent.stop="props.onSelectionOnlyPointerDown"
        @click.stop="props.onSelectionOnlyClick"
      >
        <svg
          aria-hidden="true"
          class="sfsr-action__icon sfsr-toolbar-icon sfsr-toolbar-icon--selection"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.8"
        >
          <path d="M4 7V5a2 2 0 0 1 2-2h2M4 17v2a2 2 0 0 0 2 2h2m8-18h2a2 2 0 0 1 2 2v2m-4 14h2a2 2 0 0 0 2-2v-2M8 12h8M8 8h6m-6 8h4" />
        </svg>
      </button>
      <button
        class="sfsr-button sfsr-action"
        :title="t('closePanel')"
        :aria-label="t('closePanel')"
        @click="props.onClose"
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
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { SearchOptions } from '../types'
import { t } from '@/i18n/runtime'

const props = defineProps<{
  currentIndex: number
  totalMatches: number
  isMobile?: boolean
  matchCase: boolean
  onClose: () => void
  onFindCompositionEnd: (event: CompositionEvent) => void
  onFindCompositionStart: (event: CompositionEvent) => void
  onFindEnter: (event: KeyboardEvent) => void
  onFindInput: (event: Event) => void
  onGoNext: () => void
  onGoPrev: () => void
  onJumpToIndex?: (index: number) => void
  onSelectionOnlyClick: () => void
  onSelectionOnlyPointerDown: () => void
  onToggleOption: (option: keyof SearchOptions) => void
  query: string
  selectionOnly: boolean
  useRegex: boolean
  wholeWord: boolean
}>()

const findInputRef = ref<HTMLInputElement>()
const indexInputRef = ref<HTMLInputElement>()

const isIndexFocused = ref(false)
const displayIndex = ref<string>(String(props.currentIndex))

watch(
  () => [props.currentIndex, props.totalMatches],
  () => {
    if (!isIndexFocused.value) {
      displayIndex.value = String(props.currentIndex)
    }
  },
  { immediate: true },
)

function onIndexFocus() {
  isIndexFocused.value = true
  indexInputRef.value?.select()
}

function onIndexInput(event: Event) {
  displayIndex.value = (event.target as HTMLInputElement).value
}

function onIndexEnter() {
  const val = parseInt(displayIndex.value, 10)
  if (!isNaN(val) && val >= 1 && val <= props.totalMatches) {
    props.onJumpToIndex?.(val)
  } else {
    displayIndex.value = String(props.currentIndex)
  }
  indexInputRef.value?.select()
}

function onIndexEsc() {
  displayIndex.value = String(props.currentIndex)
  indexInputRef.value?.blur()
}

function onIndexBlur() {
  isIndexFocused.value = false
  displayIndex.value = String(props.currentIndex)
}

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
