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

      <div class="sfsr-field__toggles">
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
      <button
        class="sfsr-button"
        :title="t('closePanel')"
        @click="props.onClose"
      >
        ×
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
