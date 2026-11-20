import type {
  EditorContext,
  SearchDecorationOptions,
  SearchMatch,
} from '../types'
import type { EditorBlockRoots } from './blocks'
import {
  CURRENT_TEXT_HIGHLIGHT_NAME,
  MATCH_TEXT_HIGHLIGHT_NAME,
} from './constants'
import { locateTextRange } from './ranges'

// 拆分自 editor/decorations.ts（RF-105）：CSS Custom Highlight 注册表与文本高亮缓存。
// 原实现与注释保持不变。

interface TextHighlightCacheEntry {
  context: HTMLElement
  highlightedMatchIds: Set<string>
  matches: SearchMatch[]
  optionsKey: string
  ranges: Range[]
  rangesByMatchId: Map<string, Range>
}

// document 级单例缓存：分屏双编辑器场景下由 context 归属判定保护（见 clearTextHighlightsIfOwned）
let textHighlightCache: TextHighlightCacheEntry | null = null

export function applyCurrentTextHighlight(
  context: EditorContext,
  match: SearchMatch,
  cachedRangesByMatchId?: Map<string, Range>,
  roots?: EditorBlockRoots,
) {
  const range = getReusableMatchRange(context, match, cachedRangesByMatchId, roots)
  if (!range) {
    return false
  }

  const registry = getHighlightRegistry()
  const HighlightConstructor = getHighlightConstructor()
  if (!registry || !HighlightConstructor) {
    return false
  }

  registry.set(CURRENT_TEXT_HIGHLIGHT_NAME, new HighlightConstructor(range))
  return true
}

export function clearTextHighlights() {
  getHighlightRegistry()?.delete(MATCH_TEXT_HIGHLIGHT_NAME)
  getHighlightRegistry()?.delete(CURRENT_TEXT_HIGHLIGHT_NAME)
}

/**
 * 带 context 的清除只应作用于该编辑器自身的高亮。若缓存的注册方是其他编辑器，
 * 保留注册项，避免擦掉对方正在显示的文本高亮（分屏双编辑器场景）。
 * 无 context 时为全局清理，始终删除。
 */
export function clearTextHighlightsIfOwned(context?: EditorContext | null) {
  if (!context || textHighlightCache?.context === context.protyle) {
    clearTextHighlights()
  }
}

function getHighlightRegistry() {
  const cssWithHighlights = globalThis.CSS as typeof CSS & {
    highlights?: {
      set: (name: string, highlight: unknown) => void
      delete: (name: string) => void
    }
  }

  return cssWithHighlights?.highlights
}

function getHighlightConstructor() {
  const HighlightConstructor = (globalThis as {
    Highlight?: new (...ranges: Range[]) => unknown
  }).Highlight

  return typeof HighlightConstructor === 'function' ? HighlightConstructor : null
}

export function applyMatchTextHighlights(
  context: EditorContext,
  matches: SearchMatch[],
  options: SearchDecorationOptions,
  roots?: EditorBlockRoots,
) {
  const registry = getHighlightRegistry()
  const HighlightConstructor = getHighlightConstructor()
  if (!registry || !HighlightConstructor || !matches.length) {
    return {
      highlightedMatchIds: new Set<string>(),
      rangesByMatchId: new Map<string, Range>(),
    }
  }

  const cacheEntry = resolveTextHighlightCache(context, matches, options, roots)

  if (cacheEntry.ranges.length > 0) {
    registry.set(MATCH_TEXT_HIGHLIGHT_NAME, new HighlightConstructor(...cacheEntry.ranges))
  }

  return {
    highlightedMatchIds: cacheEntry.highlightedMatchIds,
    rangesByMatchId: cacheEntry.rangesByMatchId,
  }
}

function resolveTextHighlightCache(
  context: EditorContext,
  matches: SearchMatch[],
  options: SearchDecorationOptions,
  roots?: EditorBlockRoots,
) {
  const optionsKey = buildTextHighlightOptionsKey(options)
  if (
    textHighlightCache
    && textHighlightCache.context === context.protyle
    && textHighlightCache.matches === matches
    && textHighlightCache.optionsKey === optionsKey
    && areCachedRangesReusable(context, textHighlightCache)
  ) {
    return textHighlightCache
  }

  const highlightedMatchIds = new Set<string>()
  const ranges: Range[] = []
  const rangesByMatchId = new Map<string, Range>()

  matches.forEach((match) => {
    if (shouldSkipSharedTextHighlight(match, options)) {
      return
    }

    const range = locateTextRange(context, match, roots)
    if (!range || !isReusableRange(context, range)) {
      return
    }

    ranges.push(range)
    highlightedMatchIds.add(match.id)
    rangesByMatchId.set(match.id, range)
  })

  textHighlightCache = {
    context: context.protyle,
    highlightedMatchIds,
    matches,
    optionsKey,
    ranges,
    rangesByMatchId,
  }

  return textHighlightCache
}

function buildTextHighlightOptionsKey(options: SearchDecorationOptions) {
  return [
    options.optimizeLargeCodeBlocks ? '1' : '0',
    String(options.largeCodeBlockLineThreshold ?? ''),
  ].join(':')
}

function shouldSkipSharedTextHighlight(match: SearchMatch, options: SearchDecorationOptions) {
  if (!options.optimizeLargeCodeBlocks) {
    return false
  }

  if (match.blockType !== 'NodeCodeBlock') {
    return false
  }

  const lineThreshold = options.largeCodeBlockLineThreshold
  if (!Number.isFinite(lineThreshold) || (lineThreshold ?? 0) <= 0) {
    return false
  }

  return (match.blockLineCount ?? 0) >= (lineThreshold as number)
}

function getReusableMatchRange(
  context: EditorContext,
  match: SearchMatch,
  cachedRangesByMatchId?: Map<string, Range>,
  roots?: EditorBlockRoots,
) {
  const cachedRange = cachedRangesByMatchId?.get(match.id)
  if (cachedRange && isReusableRange(context, cachedRange)) {
    return cachedRange
  }

  const range = locateTextRange(context, match, roots)
  return isReusableRange(context, range) ? range : null
}

function areCachedRangesReusable(context: EditorContext, entry: TextHighlightCacheEntry) {
  if (!entry.ranges.every((range) => isReusableRange(context, range))) {
    return false
  }

  // 引用相等无法感知编辑器的原地文本编辑：普通输入会就地改写 Text.nodeValue
  // 且节点保持 connected，此时连接性检查全部通过。必须逐 match 校验缓存 Range
  // 内的文本仍与 matchedText 一致，否则整批判定失效并重建。
  return entry.matches.every((match) => {
    const range = entry.rangesByMatchId.get(match.id)
    if (!range) {
      return true
    }

    return isRangeTextUnchanged(range, match.matchedText)
  })
}

function isRangeTextUnchanged(range: Range, matchedText: string) {
  const rangeText = range.toString()
  if (rangeText === matchedText) {
    return true
  }

  // 大小写不敏感搜索 + 就近回退定位时，Range 文本可能与 matchedText 存在大小写差异，
  // 属于合法降级而非内容漂移，按相等处理。
  return rangeText.toLowerCase() === matchedText.toLowerCase()
}

function isReusableRange(context: EditorContext, range: Range | null | undefined) {
  if (!(range instanceof Range)) {
    return false
  }

  return range.startContainer.isConnected
    && range.endContainer.isConnected
    && context.protyle.contains(range.startContainer)
    && context.protyle.contains(range.endContainer)
}
