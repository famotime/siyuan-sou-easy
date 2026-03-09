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
  onBeforeUnmount,
  ref,
  watch,
} from 'vue'
import SyButton from '@/components/SiyuanTheme/SyButton.vue'
import {
  findEditorContextByRootId,
  getActiveEditorContext,
  getBlockElement,
} from '@/features/search-replace/editor'
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
import type {
  EditorContext,
  SearchMatch,
} from '@/features/search-replace/types'

const PANEL_MARGIN = 8
const DEFAULT_PANEL_WIDTH = 648
const MIN_PANEL_WIDTH = 420
const MINIMAP_GAP = 12
const MINIMAP_WIDTH = 84
const MINIMAP_MIN_HEIGHT = 140
const MINIMAP_MAX_HEIGHT = 360
const MINIMAP_VIEWPORT_MIN_HEIGHT = 28
const MINIMAP_MARKER_MIN_HEIGHT = 3

interface MinimapDocLine {
  height: number
  left: number
  top: number
  width: number
}

interface MinimapDocBlock {
  height: number
  id: string
  lines: MinimapDocLine[]
  top: number
  variant: 'code' | 'heading' | 'list' | 'paragraph'
}

interface MinimapMarker {
  current: boolean
  height: number
  id: string
  top: number
}

interface MinimapLayout {
  blocks: MinimapDocBlock[]
  clientHeight: number
  height: number
  markers: MinimapMarker[]
  right: number
  scrollHeight: number
  top: number
  viewportHeight: number
  viewportTop: number
}

const findInputRef = ref<HTMLInputElement>()
const replaceInputRef = ref<HTMLInputElement>()
const panelRef = ref<HTMLDivElement>()
const minimapRef = ref<HTMLDivElement>()
const panelWidth = ref(resolveDefaultPanelWidth())
const minimapState = ref<MinimapLayout | null>(null)
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
let minimapScrollContainer: HTMLElement | null = null
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

const minimapStyle = computed(() => {
  if (!minimapState.value) {
    return undefined
  }

  return {
    height: `${minimapState.value.height}px`,
    right: `${minimapState.value.right}px`,
    top: `${minimapState.value.top}px`,
    width: `${MINIMAP_WIDTH}px`,
  }
})

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
  if (!resizeState || event.pointerId !== resizeState.pointerId) {
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

function onMinimapTrackClick(event: MouseEvent) {
  if (!minimapState.value || !minimapScrollContainer) {
    return
  }

  const track = event.currentTarget instanceof HTMLElement
    ? event.currentTarget
    : minimapRef.value?.querySelector<HTMLElement>('.sfsr-minimap__track')
  if (!track) {
    return
  }

  const rect = track.getBoundingClientRect()
  const trackHeight = rect.height > 0 ? rect.height : minimapState.value.height
  const trackTop = rect.height > 0 ? rect.top : minimapState.value.top
  const maxScrollTop = Math.max(0, minimapState.value.scrollHeight - minimapState.value.clientHeight)
  const clickOffset = clamp(event.clientY - trackTop, 0, trackHeight)
  const ratio = trackHeight > 0 ? clickOffset / trackHeight : 0
  const nextScrollTop = clamp(
    (ratio * minimapState.value.scrollHeight) - (minimapState.value.clientHeight / 2),
    0,
    maxScrollTop,
  )

  if (typeof minimapScrollContainer.scrollTo === 'function') {
    minimapScrollContainer.scrollTo({
      behavior: 'auto',
      top: nextScrollTop,
    })
  } else {
    minimapScrollContainer.scrollTop = nextScrollTop
  }

  refreshMinimap()
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

function clearMinimap() {
  minimapState.value = null
  syncMinimapScrollContainer(null)
}

function handleMinimapScroll() {
  refreshMinimap()
}

function refreshMinimap() {
  if (!state.visible || !state.minimapVisible) {
    clearMinimap()
    return
  }

  const context = resolveMinimapContext()
  if (!context) {
    clearMinimap()
    return
  }

  const scrollContainer = resolveMinimapScrollContainer(context)
  const scrollRect = scrollContainer.getBoundingClientRect()
  if (scrollRect.height <= 0) {
    clearMinimap()
    return
  }

  const scrollHeight = Math.max(scrollContainer.scrollHeight || 0, scrollRect.height, 1)
  const clientHeight = Math.max(scrollContainer.clientHeight || scrollRect.height, 1)
  const scrollTop = clamp(scrollContainer.scrollTop || 0, 0, Math.max(0, scrollHeight - clientHeight))
  const height = clamp(scrollRect.height - 16, MINIMAP_MIN_HEIGHT, MINIMAP_MAX_HEIGHT)
  const viewportHeight = Math.min(
    height,
    Math.max(MINIMAP_VIEWPORT_MIN_HEIGHT, (clientHeight / scrollHeight) * height),
  )
  const maxViewportTop = Math.max(0, height - viewportHeight)
  const maxScrollTop = Math.max(0, scrollHeight - clientHeight)
  const viewportTop = maxScrollTop > 0
    ? (scrollTop / maxScrollTop) * maxViewportTop
    : 0

  minimapState.value = {
    blocks: collectMinimapDocBlocks(context, scrollContainer, scrollRect, scrollHeight, height),
    clientHeight,
    height,
    markers: state.matches
      .map(match => projectMinimapMarker(context, scrollContainer, scrollRect, scrollHeight, height, match))
      .filter(Boolean) as MinimapMarker[],
    right: Math.max(PANEL_MARGIN, window.innerWidth - scrollRect.right + MINIMAP_GAP),
    scrollHeight,
    top: clamp(scrollRect.top, PANEL_MARGIN, Math.max(PANEL_MARGIN, window.innerHeight - height - PANEL_MARGIN)),
    viewportHeight,
    viewportTop,
  }
  syncMinimapScrollContainer(scrollContainer)
}

function resolveMinimapContext() {
  if (state.currentRootId) {
    return findEditorContextByRootId(state.currentRootId, state.currentTitle) ?? getActiveEditorContext()
  }

  return getActiveEditorContext()
}

function resolveMinimapScrollContainer(context: EditorContext) {
  return context.protyle.querySelector<HTMLElement>('.protyle-content')
    ?? context.protyle.querySelector<HTMLElement>('.protyle-wysiwyg')
    ?? context.protyle
}

function collectMinimapDocBlocks(
  context: EditorContext,
  scrollContainer: HTMLElement,
  scrollRect: DOMRect,
  scrollHeight: number,
  minimapHeight: number,
) {
  const blockElements = Array.from(
    context.protyle.querySelectorAll<HTMLElement>('.protyle-wysiwyg [data-node-id][data-type]'),
  )
  const seen = new Set<string>()

  return blockElements.flatMap((blockElement) => {
    const blockId = blockElement.dataset.nodeId
    if (!blockId || seen.has(blockId)) {
      return []
    }

    seen.add(blockId)
    const projectedBlock = projectMinimapDocBlock(
      blockElement,
      scrollContainer,
      scrollRect,
      scrollHeight,
      minimapHeight,
    )

    return projectedBlock ? [projectedBlock] : []
  })
}

function projectMinimapDocBlock(
  blockElement: HTMLElement,
  scrollContainer: HTMLElement,
  scrollRect: DOMRect,
  scrollHeight: number,
  minimapHeight: number,
): MinimapDocBlock | null {
  const blockId = blockElement.dataset.nodeId
  const blockType = blockElement.dataset.type
  if (!blockId || !blockType) {
    return null
  }

  const blockRect = blockElement.getBoundingClientRect()
  const projectedHeight = Math.max(
    MINIMAP_MARKER_MIN_HEIGHT,
    (Math.max(blockRect.height, 12) / scrollHeight) * minimapHeight,
  )
  const projectedTop = clamp(
    ((blockRect.top - scrollRect.top + scrollContainer.scrollTop) / scrollHeight) * minimapHeight,
    0,
    Math.max(0, minimapHeight - projectedHeight),
  )
  const variant = resolveMinimapDocVariant(blockType)

  return {
    height: projectedHeight,
    id: blockId,
    lines: buildMinimapDocLines(blockId, variant, projectedHeight),
    top: projectedTop,
    variant,
  }
}

function resolveMinimapDocVariant(blockType: string): MinimapDocBlock['variant'] {
  if (blockType === 'NodeHeading') {
    return 'heading'
  }

  if (blockType === 'NodeListItem') {
    return 'list'
  }

  if (blockType === 'NodeCodeBlock') {
    return 'code'
  }

  return 'paragraph'
}

function buildMinimapDocLines(
  blockId: string,
  variant: MinimapDocBlock['variant'],
  blockHeight: number,
): MinimapDocLine[] {
  const hash = hashMinimapId(blockId)
  const desiredLineCount = variant === 'heading'
    ? 1
    : variant === 'code'
      ? 3
      : 2
  const maxLineCount = Math.max(1, Math.floor(blockHeight / 4))
  const lineCount = Math.min(desiredLineCount, maxLineCount)
  const lineHeight = variant === 'heading' ? 3 : 2
  const spacing = lineCount === 1 ? 0 : (blockHeight - lineHeight) / (lineCount - 1)

  return Array.from({ length: lineCount }, (_, index) => {
    const left = variant === 'list'
      ? 12
      : variant === 'code'
        ? 4
        : 0
    const width = resolveMinimapLineWidth(variant, index, hash)

    return {
      height: lineHeight,
      left,
      top: lineCount === 1
        ? Math.max(0, (blockHeight - lineHeight) / 2)
        : Math.min(blockHeight - lineHeight, index * spacing),
      width: Math.min(100 - left, width),
    }
  })
}

function resolveMinimapLineWidth(
  variant: MinimapDocBlock['variant'],
  index: number,
  hash: number,
) {
  switch (variant) {
    case 'heading':
      return 76 + (hash % 14)
    case 'list':
      return index === 0 ? 64 + (hash % 14) : 48 + (hash % 18)
    case 'code':
      return index === 2 ? 62 + (hash % 16) : 78 + (hash % 12)
    case 'paragraph':
    default:
      return index === 0 ? 78 + (hash % 12) : 54 + (hash % 22)
  }
}

function hashMinimapId(value: string) {
  return Array.from(value).reduce((sum, char) => {
    return (sum + char.charCodeAt(0)) % 997
  }, 0)
}

function projectMinimapMarker(
  context: EditorContext,
  scrollContainer: HTMLElement,
  scrollRect: DOMRect,
  scrollHeight: number,
  minimapHeight: number,
  match: SearchMatch,
) {
  const blockElement = getBlockElement(context, match.blockId)
  if (!blockElement) {
    return null
  }

  const blockRect = blockElement.getBoundingClientRect()
  const markerHeight = Math.max(
    MINIMAP_MARKER_MIN_HEIGHT,
    (Math.max(blockRect.height, 12) / scrollHeight) * minimapHeight,
  )
  const markerTop = clamp(
    ((blockRect.top - scrollRect.top + scrollContainer.scrollTop) / scrollHeight) * minimapHeight,
    0,
    Math.max(0, minimapHeight - markerHeight),
  )

  return {
    current: currentMatch.value?.id === match.id,
    height: markerHeight,
    id: match.id,
    top: markerTop,
  }
}

function syncMinimapScrollContainer(nextContainer: HTMLElement | null) {
  if (minimapScrollContainer === nextContainer) {
    return
  }

  minimapScrollContainer?.removeEventListener('scroll', handleMinimapScroll)
  minimapScrollContainer = nextContainer
  minimapScrollContainer?.addEventListener('scroll', handleMinimapScroll)
}

function handleViewportResize() {
  panelWidth.value = clampPanelWidth(panelWidth.value)

  if (state.panelPosition) {
    setPanelPosition(clampPanelPosition(state.panelPosition), false)
  }

  refreshMinimap()
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
      clearMinimap()
      return
    }

    await nextTick()
    panelWidth.value = clampPanelWidth(panelWidth.value)
    if (state.panelPosition) {
      setPanelPosition(clampPanelPosition(state.panelPosition), false)
    }
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

watch(
  () => [
    state.visible,
    state.minimapVisible,
    state.currentRootId,
    state.currentTitle,
    state.currentIndex,
    state.matches.map(match => match.id).join('|'),
  ],
  () => {
    refreshMinimap()
  },
)

window.addEventListener('resize', handleViewportResize)

onBeforeUnmount(() => {
  stopDrag()
  stopResize()
  clearMinimap()
  window.removeEventListener('resize', handleViewportResize)
})
</script>
