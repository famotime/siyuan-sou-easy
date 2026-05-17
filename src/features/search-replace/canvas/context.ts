import type { EditorContext } from '../types'
import type { CanvasSearchHost } from './types'

export function getCanvasSearchRegistry(): Set<CanvasSearchHost> {
  return (globalThis as typeof globalThis & {
    __siyuanCanvasSearchHosts?: Set<CanvasSearchHost>
  }).__siyuanCanvasSearchHosts ?? new Set()
}

export function getActiveCanvasSearchContext(): EditorContext | null {
  const hosts = Array.from(getCanvasSearchRegistry())
    .filter(isRenderableCanvasHost)
    .sort(compareCanvasHostPreference)
  const host = hosts[0]
  if (!host) {
    return null
  }

  const context = host.getContext()
  return {
    canvas: {
      filePath: context.filePath,
      host,
      readonly: context.readonly,
    },
    protyle: host.root,
    rootId: context.id,
    sourceKind: 'canvas',
    title: context.title,
  }
}

export function findCanvasSearchContextByRootId(rootId: string) {
  const normalizedRootId = rootId.trim()
  if (!normalizedRootId) {
    return null
  }

  const host = Array.from(getCanvasSearchRegistry())
    .find(candidate => candidate.getContext().id === normalizedRootId)
  if (!host) {
    return null
  }

  const context = host.getContext()
  return {
    canvas: {
      filePath: context.filePath,
      host,
      readonly: context.readonly,
    },
    protyle: host.root,
    rootId: context.id,
    sourceKind: 'canvas' as const,
    title: context.title,
  }
}

function isRenderableCanvasHost(host: CanvasSearchHost) {
  const root = host.root
  if (!isElementLike(root) || root.isConnected === false) {
    return false
  }

  return !root.classList.contains('fn__none')
    && !root.closest('.fn__none')
}

function compareCanvasHostPreference(left: CanvasSearchHost, right: CanvasSearchHost) {
  const leftScore = getHostPreferenceScore(left)
  const rightScore = getHostPreferenceScore(right)
  if (leftScore.inActiveWindow !== rightScore.inActiveWindow) {
    return leftScore.inActiveWindow ? -1 : 1
  }

  return leftScore.distanceToViewportCenter - rightScore.distanceToViewportCenter
}

function getHostPreferenceScore(host: CanvasSearchHost) {
  const rect = host.root.getBoundingClientRect()
  const rectCenterY = Number.isFinite(rect.top) && Number.isFinite(rect.bottom)
    ? (rect.top + rect.bottom) / 2
    : Number.POSITIVE_INFINITY
  const rectCenterX = Number.isFinite(rect.left) && Number.isFinite(rect.right)
    ? (rect.left + rect.right) / 2
    : Number.POSITIVE_INFINITY

  return {
    distanceToViewportCenter: Math.abs(rectCenterY - window.innerHeight / 2)
      + Math.abs(rectCenterX - window.innerWidth / 2),
    inActiveWindow: isElementLike(host.root) && Boolean(host.root.closest('.layout__wnd--active')),
  }
}

function isElementLike(value: unknown): value is HTMLElement {
  const candidate = value as Partial<HTMLElement> | null | undefined
  return Boolean(
    candidate
      && typeof candidate.closest === 'function'
      && typeof candidate.getBoundingClientRect === 'function'
      && candidate.classList
      && typeof candidate.classList.contains === 'function',
  )
}
