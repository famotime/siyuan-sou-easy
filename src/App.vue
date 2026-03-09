<template>
  <div
    v-if="state.visible"
    ref="panelRef"
    class="sfsr-panel"
    :style="panelStyle"
    @pointerdown="onPanelPointerDown"
    @dblclick="onPanelDoubleClick"
    @keydown.esc.stop.prevent="closePanel"
  >
    <div
      class="sfsr-resize-handle"
      aria-hidden="true"
      @dblclick.stop
      @pointerdown.stop="onResizeHandlePointerDown"
    />
    <div
      class="sfsr-layout"
      :class="{ 'sfsr-layout--replace-visible': state.replaceVisible }"
    >
      <button
        class="sfsr-button sfsr-icon-button sfsr-replace-toggle"
        :class="{ 'sfsr-replace-toggle--expanded': state.replaceVisible }"
        type="button"
        :aria-expanded="String(state.replaceVisible)"
        aria-label="展开或折叠替换栏"
        title="展开或折叠替换栏"
        @click="toggleReplaceVisible"
      >
        <span
          aria-hidden="true"
          class="sfsr-chevron"
          :class="{ 'sfsr-chevron--expanded': state.replaceVisible }"
        />
      </button>

      <div class="sfsr-main">
        <div class="sfsr-row">
          <input
            ref="findInputRef"
            :value="state.query"
            class="b3-text-field sfsr-input"
            placeholder="查找"
            @compositionstart="onFindCompositionStart"
            @compositionend="onFindCompositionEnd"
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
          <button
            :class="optionButtonClass(state.options.selectionOnly)"
            class="sfsr-button"
            title="仅在选中范围内查找和替换"
            @pointerdown.prevent.stop="onSelectionOnlyPointerDown"
            @click.stop="onSelectionOnlyClick"
          >
            选区
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
            @compositionstart="onReplaceCompositionStart"
            @compositionend="onReplaceCompositionEnd"
            @input="onReplaceInput"
            @keydown.enter.prevent="replaceCurrent"
          />
          <SyButton
            class="sfsr-action"
            :disabled="!canReplaceCurrent"
            @click="replaceCurrent"
          >
            替换当前
          </SyButton>
          <SyButton
            class="sfsr-action"
            :disabled="!state.matches.length"
            @click="skipCurrent"
          >
            跳过
          </SyButton>
          <SyButton
            class="sfsr-action"
            :disabled="!state.matches.length"
            @click="replaceAll"
          >
            全部替换
          </SyButton>
        </div>

        <div
          v-if="showRegexHelp"
          class="sfsr-regex-help"
        >
          <div class="sfsr-regex-help__title">
            {{ regexHelpTitle }}
          </div>
          <div class="sfsr-regex-help__note">
            {{ regexHelpNote }}
          </div>
          <ul class="sfsr-regex-help__examples">
            <li
              v-for="example in regexHelpExamples"
              :key="example.pattern"
            >
              <code>{{ example.pattern }}</code>
              <span>{{ example.description }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div
      v-if="statusText"
      class="sfsr-status"
      :class="{ 'sfsr-status--error': Boolean(state.error) }"
    >
      {{ statusText }}
    </div>
  </div>

  <div
    v-if="minimapState"
    ref="minimapRef"
    class="sfsr-minimap"
    :style="minimapStyle"
  >
    <div
      class="sfsr-minimap__track"
      @click="onMinimapTrackClick"
    >
      <div class="sfsr-minimap__doc">
        <div
          v-for="block in minimapState.blocks"
          :key="block.id"
          class="sfsr-minimap__doc-block"
          :class="`sfsr-minimap__doc-block--${block.variant}`"
          :style="{
            height: `${block.height}px`,
            top: `${block.top}px`,
          }"
        >
          <span
            v-for="(line, index) in block.lines"
            :key="`${block.id}:${index}`"
            class="sfsr-minimap__doc-line"
            :style="{
              height: `${line.height}px`,
              left: `${line.left}%`,
              top: `${line.top}px`,
              width: `${line.width}%`,
            }"
          />
        </div>
      </div>
      <div
        v-for="marker in minimapState.markers"
        :key="marker.id"
        class="sfsr-minimap__marker"
        :class="{ 'sfsr-minimap__marker--current': marker.current }"
        :style="{
          height: `${marker.height}px`,
          top: `${marker.top}px`,
        }"
      />
      <div
        class="sfsr-minimap__viewport"
        :style="{
          height: `${minimapState.viewportHeight}px`,
          top: `${minimapState.viewportTop}px`,
        }"
      />
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
import SyButton from '@/components/SiyuanTheme/SyButton.vue'
import {
  captureCurrentSelectionScope,
  closePanel,
  getCurrentMatch,
  goNext,
  goPrev,
  persistPanelPosition,
  replaceAll,
  replaceCurrent,
  resetStoredPanelPosition,
  searchReplaceState as state,
  setPanelPosition,
  setQuery,
  setReplacement,
  skipCurrent,
  toggleOption,
  toggleReplaceVisible,
} from '@/features/search-replace/store'
import {
  REGEX_HELP_EXAMPLES,
  REGEX_HELP_NOTE,
  REGEX_HELP_TITLE,
} from '@/features/search-replace/ui/regex-help'
import { useComposedInput } from '@/features/search-replace/ui/use-composed-input'
import { usePanelFrame } from '@/features/search-replace/ui/use-panel-frame'
import { usePanelMinimap } from '@/features/search-replace/ui/use-panel-minimap'

const findInputRef = ref<HTMLInputElement>()
const replaceInputRef = ref<HTMLInputElement>()
const panelRef = ref<HTMLDivElement>()
const currentMatch = computed(() => getCurrentMatch())
const regexHelpTitle = REGEX_HELP_TITLE
const regexHelpNote = REGEX_HELP_NOTE
const regexHelpExamples = REGEX_HELP_EXAMPLES
const showRegexHelp = computed(() => state.options.useRegex)
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
const {
  clearMinimap,
  minimapRef,
  minimapState,
  minimapStyle,
  onMinimapTrackClick,
  refreshMinimap,
} = usePanelMinimap({
  currentMatch,
  state,
})
const {
  onPanelDoubleClick,
  onPanelPointerDown,
  onResizeHandlePointerDown,
  panelStyle,
  stopPanelInteractions,
  syncPanelBoundsToViewport,
} = usePanelFrame({
  getPanelPosition: () => state.panelPosition,
  onViewportResize: refreshMinimap,
  panelRef,
  persistPanelPosition,
  resetStoredPanelPosition,
  setPanelPosition,
})
const {
  onCompositionEnd: onFindCompositionEnd,
  onCompositionStart: onFindCompositionStart,
  onInput: onFindInput,
} = useComposedInput(setQuery)
const {
  onCompositionEnd: onReplaceCompositionEnd,
  onCompositionStart: onReplaceCompositionStart,
  onInput: onReplaceInput,
} = useComposedInput(setReplacement)

function optionButtonClass(active: boolean) {
  return {
    'sfsr-button--active': active,
  }
}

function onSelectionOnlyPointerDown() {
  if (!state.options.selectionOnly) {
    captureCurrentSelectionScope()
  }
}

function onSelectionOnlyClick() {
  const enabling = !state.options.selectionOnly
  if (enabling) {
    captureCurrentSelectionScope()
  }

  toggleOption('selectionOnly')

  if (enabling) {
    window.getSelection()?.removeAllRanges()
  }
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
      stopPanelInteractions()
      clearMinimap()
      return
    }

    await nextTick()
    syncPanelBoundsToViewport()
    findInputRef.value?.focus()
    findInputRef.value?.select()
    refreshMinimap()
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
