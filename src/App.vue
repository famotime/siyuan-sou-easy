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
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
} from 'vue'
import SyButton from '@/components/SiyuanTheme/SyButton.vue'
import {
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

const PANEL_MARGIN = 8
const DEFAULT_PANEL_WIDTH = 648
const MIN_PANEL_WIDTH = 420

const findInputRef = ref<HTMLInputElement>()
const replaceInputRef = ref<HTMLInputElement>()
const panelRef = ref<HTMLDivElement>()
const panelWidth = ref(resolveDefaultPanelWidth())
const NON_DRAG_SELECTOR = [
  'input',
  'textarea',
  'button',
  'select',
  'option',
  'a',
  '[contenteditable]:not([contenteditable="false"])',
  '.sfsr-no-drag',
].join(', ')

let dragState: {
  pointerId: number
  panelLeft: number
  panelTop: number
  startClientX: number
  startClientY: number
} | null = null
let resizeState: {
  pointerId: number
  panelRight: number
  panelTop: number
} | null = null
let isFindComposing = false
let isReplaceComposing = false

const regexHelpTitle = '正则搜索帮助'
const regexHelpNote = '当前已支持正则搜索；替换文本仍按字面量写入，暂不支持 $1、\\1 等捕获组回填。'
const regexHelpExamples = [
  {
    pattern: '安装|部署',
    description: '匹配“安装”或“部署”',
  },
  {
    pattern: '安装\\s+插件',
    description: '匹配中间含空白的“安装 插件”',
  },
  {
    pattern: 'v\\d+\\.\\d+\\.\\d+',
    description: '匹配版本号，例如 v1.2.3',
  },
]

const currentMatch = computed(() => getCurrentMatch())
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
const panelStyle = computed(() => {
  const style: Record<string, string> = {
    width: `${panelWidth.value}px`,
  }

  if (!state.panelPosition) {
    return style
  }

  return {
    ...style,
    left: `${state.panelPosition.left}px`,
    top: `${state.panelPosition.top}px`,
    transform: 'none',
  }
})

function optionButtonClass(active: boolean) {
  return {
    'sfsr-button--active': active,
  }
}

function onFindInput(event: Event) {
  if (isFindComposing) {
    return
  }

  setQuery((event.target as HTMLInputElement).value)
}

function onReplaceInput(event: Event) {
  if (isReplaceComposing) {
    return
  }

  setReplacement((event.target as HTMLInputElement).value)
}

function onFindCompositionStart() {
  isFindComposing = true
}

function onFindCompositionEnd(event: CompositionEvent) {
  isFindComposing = false
  setQuery((event.target as HTMLInputElement).value)
}

function onReplaceCompositionStart() {
  isReplaceComposing = true
}

function onReplaceCompositionEnd(event: CompositionEvent) {
  isReplaceComposing = false
  setReplacement((event.target as HTMLInputElement).value)
}

function onFindEnter(event: KeyboardEvent) {
  if (event.shiftKey) {
    goPrev()
    return
  }

  goNext()
}

function onPanelPointerDown(event: PointerEvent) {
  if (event.button !== 0 || !canStartPanelDrag(event.target)) {
    return
  }

  event.preventDefault()
  startDrag(event)
}

function onResizeHandlePointerDown(event: PointerEvent) {
  if (event.button !== 0) {
    return
  }

  event.preventDefault()
  startResize(event)
}

function onPanelDoubleClick(event: MouseEvent) {
  if (!canStartPanelDrag(event.target)) {
    return
  }

  resetPanelPosition()
}

function startDrag(event: PointerEvent) {
  if (!panelRef.value) {
    return
  }

  stopResize()

  const rect = panelRef.value.getBoundingClientRect()
  setPanelPosition({
    left: rect.left,
    top: rect.top,
  }, false)

  dragState = {
    pointerId: event.pointerId,
    panelLeft: rect.left,
    panelTop: rect.top,
    startClientX: event.clientX,
    startClientY: event.clientY,
  }

  document.body.classList.add('sfsr-dragging')
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', stopDrag)
  window.addEventListener('pointercancel', stopDrag)
}

function startResize(event: PointerEvent) {
  if (!panelRef.value) {
    return
  }

  stopDrag()

  const rect = panelRef.value.getBoundingClientRect()
  const width = clampPanelWidth(rect.width)
  panelWidth.value = width
  setPanelPosition({
    left: rect.right - width,
    top: rect.top,
  }, false)

  resizeState = {
    pointerId: event.pointerId,
    panelRight: rect.right,
    panelTop: rect.top,
  }

  document.body.classList.add('sfsr-resizing')
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', stopResize)
  window.addEventListener('pointercancel', stopResize)
}

function onDragMove(event: PointerEvent) {
  if (!dragState || event.pointerId !== dragState.pointerId) {
    return
  }

  const nextLeft = dragState.panelLeft + (event.clientX - dragState.startClientX)
  const nextTop = dragState.panelTop + (event.clientY - dragState.startClientY)
  setPanelPosition(clampPanelPosition({
    left: nextLeft,
    top: nextTop,
  }), false)
}

function stopDrag(event?: PointerEvent) {
  if (event && dragState && event.pointerId !== dragState.pointerId) {
    return
  }

  dragState = null
  persistPanelPosition()
  document.body.classList.remove('sfsr-dragging')
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', stopDrag)
  window.removeEventListener('pointercancel', stopDrag)
}

function onResizeMove(event: PointerEvent) {
  if (!resizeState) {
    return
  }

  if (event.pointerId !== resizeState.pointerId) {
    return
  }

  const nextWidth = clampPanelWidth(resizeState.panelRight - event.clientX)
  const nextLeft = resizeState.panelRight - nextWidth
  panelWidth.value = nextWidth
  setPanelPosition(clampPanelPosition({
    left: nextLeft,
    top: resizeState.panelTop,
  }, nextWidth), false)
}

function stopResize(event?: PointerEvent) {
  if (event && resizeState && event.pointerId !== resizeState.pointerId) {
    return
  }

  resizeState = null
  persistPanelPosition()
  document.body.classList.remove('sfsr-resizing')
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', stopResize)
  window.removeEventListener('pointercancel', stopResize)
}

function resetPanelPosition() {
  resetStoredPanelPosition()
}

function canStartPanelDrag(target: EventTarget | null) {
  const element = resolveEventElement(target)

  if (!element) {
    return true
  }

  return !element.closest(NON_DRAG_SELECTOR)
}

function resolveEventElement(target: EventTarget | null) {
  if (target instanceof Element) {
    return target
  }

  if (target instanceof Node) {
    return target.parentElement
  }

  return null
}

function clampPanelPosition(position: { left: number, top: number }, width = panelWidth.value) {
  const panelHeight = panelRef.value?.offsetHeight ?? 0
  const maxLeft = Math.max(PANEL_MARGIN, window.innerWidth - width - PANEL_MARGIN)
  const maxTop = Math.max(PANEL_MARGIN, window.innerHeight - panelHeight - PANEL_MARGIN)

  return {
    left: clamp(position.left, PANEL_MARGIN, maxLeft),
    top: clamp(position.top, PANEL_MARGIN, maxTop),
  }
}

function clampPanelWidth(width: number) {
  const maxWidth = Math.max(MIN_PANEL_WIDTH, window.innerWidth - (PANEL_MARGIN * 2))
  return clamp(width, MIN_PANEL_WIDTH, maxWidth)
}

function resolveDefaultPanelWidth() {
  if (typeof window === 'undefined') {
    return DEFAULT_PANEL_WIDTH
  }

  return clampPanelWidth(DEFAULT_PANEL_WIDTH)
}

function handleViewportResize() {
  panelWidth.value = clampPanelWidth(panelWidth.value)

  if (!state.panelPosition) {
    return
  }

  setPanelPosition(clampPanelPosition(state.panelPosition), false)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

watch(
  () => state.visible,
  async (visible) => {
    if (!visible) {
      stopDrag()
      stopResize()
      return
    }

    await nextTick()
    panelWidth.value = clampPanelWidth(panelWidth.value)
    if (state.panelPosition) {
      setPanelPosition(clampPanelPosition(state.panelPosition), false)
    }
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

window.addEventListener('resize', handleViewportResize)

onBeforeUnmount(() => {
  stopDrag()
  stopResize()
  window.removeEventListener('resize', handleViewportResize)
})
</script>
