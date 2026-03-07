<template>
  <div
    v-if="state.visible"
    class="sfsr-panel"
    @keydown.esc.stop.prevent="closePanel"
  >
    <div class="sfsr-row">
      <input
        ref="findInputRef"
        :value="state.query"
        class="b3-text-field sfsr-input"
        placeholder="查找"
        @input="onFindInput"
        @keydown.enter.prevent="onFindEnter"
      />

      <button
        :class="optionButtonClass(state.options.matchCase)"
        class="sfsr-button"
        title="区分大小写"
        @click="toggleOption('matchCase')"
      >
        Aa
      </button>
      <button
        :class="optionButtonClass(state.options.wholeWord)"
        class="sfsr-button"
        title="全词匹配"
        @click="toggleOption('wholeWord')"
      >
        ab
      </button>
      <button
        :class="optionButtonClass(state.options.useRegex)"
        class="sfsr-button"
        title="使用正则"
        @click="toggleOption('useRegex')"
      >
        .*
      </button>

      <div class="sfsr-count">{{ counterText }}</div>

      <button
        class="sfsr-button"
        title="上一项"
        @click="goPrev"
      >
        ↑
      </button>
      <button
        class="sfsr-button"
        title="下一项"
        @click="goNext"
      >
        ↓
      </button>
      <button
        :class="optionButtonClass(state.replaceVisible)"
        class="sfsr-button"
        title="显示替换栏"
        @click="toggleReplaceVisible"
      >
        替
      </button>
      <button
        class="sfsr-button"
        title="关闭"
        @click="closePanel"
      >
        ×
      </button>
    </div>

    <div
      v-if="state.replaceVisible"
      class="sfsr-row sfsr-row--secondary"
    >
      <input
        ref="replaceInputRef"
        :value="state.replacement"
        class="b3-text-field sfsr-input"
        placeholder="替换"
        @input="onReplaceInput"
        @keydown.enter.prevent="replaceCurrent"
      />
      <button
        class="b3-button b3-button--outline sfsr-action"
        :disabled="!canReplaceCurrent"
        @click="replaceCurrent"
      >
        替换当前
      </button>
      <button
        class="b3-button b3-button--outline sfsr-action"
        :disabled="!state.matches.length"
        @click="skipCurrent"
      >
        跳过
      </button>
      <button
        class="b3-button b3-button--outline sfsr-action"
        :disabled="!state.matches.length"
        @click="replaceAll"
      >
        全部替换
      </button>
    </div>

    <div
      v-if="statusText"
      class="sfsr-status"
      :class="{ 'sfsr-status--error': Boolean(state.error) }"
    >
      {{ statusText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  ref,
  watch,
} from 'vue'
import {
  closePanel,
  getCurrentMatch,
  goNext,
  goPrev,
  replaceAll,
  replaceCurrent,
  searchReplaceState as state,
  setQuery,
  setReplacement,
  skipCurrent,
  toggleOption,
  toggleReplaceVisible,
} from '@/features/search-replace/store'

const findInputRef = ref<HTMLInputElement>()
const replaceInputRef = ref<HTMLInputElement>()

const currentMatch = computed(() => getCurrentMatch())
const counterText = computed(() => {
  if (!state.query) {
    return '0 of 0'
  }

  if (!state.matches.length) {
    return '0 of 0'
  }

  return `${state.currentIndex + 1} of ${state.matches.length}`
})

const statusText = computed(() => {
  if (state.error) {
    return state.error
  }

  const parts: string[] = []
  if (state.currentTitle) {
    parts.push(`当前文档：${state.currentTitle}`)
  }
  if (currentMatch.value?.previewText) {
    parts.push(currentMatch.value.previewText)
  }
  if (currentMatch.value && !currentMatch.value.replaceable) {
    parts.push('当前命中跨越复杂格式，暂不支持直接替换')
  }
  return parts.join(' · ')
})

const canReplaceCurrent = computed(() => Boolean(currentMatch.value?.replaceable) && !state.busy)

function optionButtonClass(active: boolean) {
  return {
    'sfsr-button--active': active,
  }
}

function onFindInput(event: Event) {
  setQuery((event.target as HTMLInputElement).value)
}

function onReplaceInput(event: Event) {
  setReplacement((event.target as HTMLInputElement).value)
}

function onFindEnter(event: KeyboardEvent) {
  if (event.shiftKey) {
    goPrev()
    return
  }

  goNext()
}

watch(
  () => state.visible,
  async (visible) => {
    if (!visible) {
      return
    }

    await nextTick()
    findInputRef.value?.focus()
    findInputRef.value?.select()
  },
)

watch(
  () => state.replaceVisible,
  async (visible) => {
    if (!visible || !state.visible) {
      return
    }

    await nextTick()
    if (!state.replacement) {
      return
    }

    replaceInputRef.value?.focus()
  },
)
</script>
