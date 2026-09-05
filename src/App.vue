<template>
  <div
    v-if="state.visible"
    ref="panelRef"
    class="sfsr-panel"
    :class="{ 'sfsr-panel--mobile': isMobile }"
    :style="panelStyle"
    @pointerdown="onPanelPointerDown"
    @dblclick="onPanelDoubleClick"
    @keydown.esc.stop.prevent="closePanel"
  >
    <div
      v-if="!isMobile"
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
        :aria-label="t('replaceToggle')"
        :title="t('replaceToggle')"
        @click="toggleReplaceVisible"
      >
        <span
          aria-hidden="true"
          class="sfsr-chevron"
          :class="{ 'sfsr-chevron--expanded': state.replaceVisible }"
        />
      </button>

      <div class="sfsr-main">
        <SearchToolbarRow
          ref="searchToolbarRef"
          :current-index="currentMatchIndex"
          :total-matches="totalMatches"
          :is-mobile="isMobile"
          :match-case="state.options.matchCase"
          :on-close="closePanel"
          :on-find-composition-end="onFindCompositionEnd"
          :on-find-composition-start="onFindCompositionStart"
          :on-find-enter="onFindEnter"
          :on-find-input="onFindInput"
          :on-go-next="goNext"
          :on-go-prev="goPrev"
          :on-jump-to-index="jumpToMatchIndex"
          :on-selection-only-click="onSelectionOnlyClick"
          :on-selection-only-pointer-down="onSelectionOnlyPointerDown"
          :on-toggle-option="toggleOption"
          :query="state.query"
          :selection-only="state.options.selectionOnly"
          :use-regex="state.options.useRegex"
          :whole-word="state.options.wholeWord"
        />

        <ReplaceActionRow
          v-if="state.replaceVisible"
          ref="replaceToolbarRef"
          :can-replace-all="canReplaceAll"
          :can-replace-current="canReplaceCurrent"
          :has-matches="Boolean(state.matches.length)"
          :is-mobile="isMobile"
          :on-extract-all="extractAll"
          :on-replace-all="replaceAll"
          :on-replace-composition-end="onReplaceCompositionEnd"
          :on-replace-composition-start="onReplaceCompositionStart"
          :on-replace-current="replaceCurrent"
          :on-replace-input="onReplaceInput"
          :on-skip-current="skipCurrent"
          :on-toggle-preserve-case="togglePreserveCase"
          :preserve-case="state.preserveCase"
          :replace-input-disabled="replaceInputDisabled"
          :replacement="state.replacement"
        />

        <RegexHelpPanel
          v-if="showRegexHelp && !isMobile"
          :examples="regexHelpExamples"
          :note="regexHelpNote"
          :title="regexHelpTitle"
        />
      </div>
    </div>

    <div
      v-if="hasStatus"
      class="sfsr-status"
      :class="{
        'sfsr-status--error': Boolean(state.error),
        'sfsr-status--pending': hasPendingStatus,
      }"
      :aria-live="hasPendingStatus ? 'polite' : undefined"
      :role="hasPendingStatus ? 'status' : undefined"
    >
      <span
        v-if="hasPendingStatus"
        aria-hidden="true"
        class="sfsr-status__spinner"
      />
      <span class="sfsr-status__content">
        <span
          v-if="primaryStatusText"
          class="sfsr-status__line"
        >
          <template v-if="state.error">
            {{ primaryStatusText }}
          </template>
          <template v-else>
            <template
              v-for="(seg, idx) in primaryStatusSegments"
              :key="idx"
            >
              <strong
                v-if="seg.isMatch"
                class="sfsr-status__match"
              >{{ seg.text }}</strong>
              <span v-else>{{ seg.text }}</span>
            </template>
          </template>
        </span>
        <span
          v-if="navigationStatusText"
          class="sfsr-status__line sfsr-status__line--pending"
        >
          {{ navigationStatusText }}
        </span>
        <span
          v-if="secondaryStatusText"
          class="sfsr-status__line"
        >
          {{ secondaryStatusText }}
        </span>
      </span>
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
  onUnmounted,
  ref,
  watch,
} from 'vue'
import { detectPluginEnvironment } from '@/features/search-replace/plugin-environment'
import { t } from '@/i18n/runtime'

const { isMobile } = detectPluginEnvironment()
import {
  hasAttributeViewMatches,
  hasUnsupportedCanvasReplacementMatches,
  isAttributeViewMatch,
  parsePreviewSegments,
} from '@/features/search-replace/match-utils'
import {
  captureCurrentSelectionScope,
  closePanel,
  getCurrentMatch,
  goNext,
  goPrev,
  jumpToMatchIndex,
  onEditorContextChanged,
  persistPanelPosition,
  extractAll,
  replaceAll,
  replaceCurrent,
  resetStoredPanelPosition,
  searchReplaceState as state,
  setPanelPosition,
  setPanelWidth,
  setQuery,
  setReplacement,
  skipCurrent,
  toggleOption,
  togglePreserveCase,
  toggleReplaceVisible,
} from '@/features/search-replace/store'
import RegexHelpPanel from '@/features/search-replace/ui/RegexHelpPanel.vue'
import ReplaceActionRow from '@/features/search-replace/ui/ReplaceActionRow.vue'
import SearchToolbarRow from '@/features/search-replace/ui/SearchToolbarRow.vue'
import { useComposedInput } from '@/features/search-replace/ui/use-composed-input'
import { usePanelFrame } from '@/features/search-replace/ui/use-panel-frame'
import { usePanelMinimap } from '@/features/search-replace/ui/use-panel-minimap'

const panelRef = ref<HTMLDivElement>()
const searchToolbarRef = ref<{
  focusInput: () => void
  selectInput: () => void
}>()
const replaceToolbarRef = ref<{
  focusInput: () => void
}>()
const currentMatch = computed(() => getCurrentMatch())
const regexHelpTitle = computed(() => t('regexHelpTitle'))
const regexHelpNote = computed(() => t('regexHelpNote'))
const regexHelpExamples = computed(() => [
  {
    description: t('regexHelpDescAlternation'),
    pattern: t('regexHelpPatternAlternation'),
  },
  {
    description: t('regexHelpDescWhitespace'),
    pattern: t('regexHelpPatternWhitespace'),
  },
  {
    description: t('regexHelpDescVersion'),
    pattern: t('regexHelpPatternVersion'),
  },
])
const showRegexHelp = computed(() => state.options.useRegex)
const isTerminalMode = computed(() => state.sourceMode === 'terminal')
const isPendingNavigation = computed(() => Boolean(state.navigationHint) && !state.error)
const isSearching = computed(() => Boolean(state.searching) && !state.error)
const hasPendingStatus = computed(() => isPendingNavigation.value || isSearching.value)
const primaryStatusText = computed(() => {
  if (state.error) {
    return state.error
  }

  return currentMatch.value?.previewText ?? ''
})
const primaryStatusSegments = computed(() => {
  if (state.error || !primaryStatusText.value) {
    return []
  }

  return parsePreviewSegments(
    primaryStatusText.value,
    currentMatch.value?.matchedText,
  )
})
const navigationStatusText = computed(() => {
  if (state.error) {
    return ''
  }

  if (state.navigationHint) {
    return state.navigationHint
  }

  if (state.searching) {
    return t('searchPending')
  }

  return ''
})
const secondaryStatusText = computed(() => {
  if (state.error) {
    return ''
  }

  if (isTerminalMode.value && state.replaceVisible) {
    return t('replaceTerminalUnsupported')
  }

  if (currentMatch.value && isAttributeViewMatch(currentMatch.value)) {
    return t('replaceAttributeViewUnsupported')
  }

  if (currentMatch.value && !currentMatch.value.replaceable) {
    return t('replaceCurrentUnsupported')
  }

  return ''
})
const hasStatus = computed(() => Boolean(
  primaryStatusText.value
  || navigationStatusText.value
  || secondaryStatusText.value,
))
const currentMatchIndex = computed(() => {
  return state.query && state.matches.length ? state.currentIndex + 1 : 0
})
const totalMatches = computed(() => {
  return state.query ? state.matches.length : 0
})

const replaceInputDisabled = computed(() => state.documentReadonly || isTerminalMode.value)
const canReplaceCurrent = computed(() =>
  !isTerminalMode.value
  && !state.documentReadonly
  && Boolean(currentMatch.value?.replaceable)
  && !state.busy,
)
const canReplaceAll = computed(() =>
  !isTerminalMode.value
  && !state.documentReadonly
  && Boolean(state.matches.length)
  && !hasAttributeViewMatches(state.matches)
  && !hasUnsupportedCanvasReplacementMatches(state.matches)
  && !state.busy,
)
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
  getPanelWidth: () => state.panelWidth,
  onViewportResize: refreshMinimap,
  panelRef,
  persistPanelPosition,
  resetStoredPanelPosition,
  setPanelPosition,
  setPanelWidth,
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
    searchToolbarRef.value?.focusInput()
    searchToolbarRef.value?.selectInput()
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

    replaceToolbarRef.value?.focusInput()
  },
)
</script>
