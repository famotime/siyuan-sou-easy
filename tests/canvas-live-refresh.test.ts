/* @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest'

import { createSearchDocumentEventController } from '@/features/search-replace/store/search-document-events'

describe('canvas live refresh', () => {
  it('subscribes to canvas host changes and schedules a refresh', () => {
    let listener: (() => void) | null = null
    const unsubscribe = vi.fn()
    const scheduleRefresh = vi.fn()
    const host = {
      subscribe: vi.fn((nextListener: () => void) => {
        listener = nextListener
        return unsubscribe
      }),
    }
    const controller = createSearchDocumentEventController({
      clearSelectionScope: vi.fn(),
      invalidateDocumentSnapshot: vi.fn(),
      rememberEditorContext: vi.fn(),
      rememberHintedEditorContext: vi.fn(),
      rememberSelectionScope: vi.fn(),
      resolveEditorContext: vi.fn(),
      scheduleRefresh,
      state: {
        busy: false,
        query: 'Alpha',
        visible: true,
      } as any,
    })

    controller.syncLiveRefreshObserver({
      canvas: { host },
      protyle: {} as HTMLElement,
      rootId: 'canvas:/data/a.canvas',
      sourceKind: 'canvas',
      title: 'a.canvas',
    } as any)
    listener?.()

    expect(host.subscribe).toHaveBeenCalledTimes(1)
    expect(scheduleRefresh).toHaveBeenCalledWith(80)

    controller.reset()
    expect(unsubscribe).toHaveBeenCalled()
  })
})
