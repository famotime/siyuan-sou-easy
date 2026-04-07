import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  advanceApproximateNavigationProgress,
  createApproximateNavigationProgress,
  createDirectNavigationProgress,
  resolveApproximateNavigationTimeoutReason,
  resolveDirectNavigationAction,
} from '@/features/search-replace/store/search-pending-navigation-state'

describe('search pending navigation state helpers', () => {
  it('resets approximate retry counters when the progress key changes', () => {
    const previous = {
      ...createApproximateNavigationProgress(),
      lowerBoundaryAttempts: 7,
      previousKey: '10:20:300:1000:protyle-content',
      stalledAttempts: 5,
      upperBoundaryAttempts: 4,
    }

    const next = advanceApproximateNavigationProgress(previous, {
      key: '40:50:900:1000:protyle-content',
      waitingAtLowerBoundary: true,
      waitingAtUpperBoundary: false,
    })

    expect(next).toEqual({
      lowerBoundaryAttempts: 1,
      previousKey: '40:50:900:1000:protyle-content',
      stalledAttempts: 1,
      upperBoundaryAttempts: 0,
    })
  })

  it('increments stalled attempts when approximate navigation makes no key or boundary progress', () => {
    const previous = {
      ...createApproximateNavigationProgress(),
      previousKey: '10:20:300:1000:protyle-content',
      stalledAttempts: 3,
    }

    const next = advanceApproximateNavigationProgress(previous, {
      key: '10:20:300:1000:protyle-content',
      waitingAtLowerBoundary: false,
      waitingAtUpperBoundary: false,
    })

    expect(next.stalledAttempts).toBe(4)
    expect(next.lowerBoundaryAttempts).toBe(0)
    expect(next.upperBoundaryAttempts).toBe(0)
  })

  it('resolves boundary and stalled timeout reasons at the existing thresholds', () => {
    expect(resolveApproximateNavigationTimeoutReason({
      ...createApproximateNavigationProgress(),
      lowerBoundaryAttempts: 200,
    })).toBe('lower-boundary-timeout')

    expect(resolveApproximateNavigationTimeoutReason({
      ...createApproximateNavigationProgress(),
      upperBoundaryAttempts: 200,
    })).toBe('upper-boundary-timeout')

    expect(resolveApproximateNavigationTimeoutReason({
      ...createApproximateNavigationProgress(),
      stalledAttempts: 40,
    })).toBe('stalled-timeout')
  })

  it('resets direct protyle attempts when rendered progress changes and falls back after repeated stalls', () => {
    let state = createDirectNavigationProgress()
    const protyleRef = { element: {} } as never

    const firstAttempt = resolveDirectNavigationAction(state, {
      matchId: 'block-80:0:3',
      progressKey: '39:39:1:visible-segment',
      protyleRef,
    })
    expect(firstAttempt.kind).toBe('start')
    state = firstAttempt.state

    const progressedAttempt = resolveDirectNavigationAction(state, {
      matchId: 'block-80:0:3',
      progressKey: '39:45:7:visible-segment',
      protyleRef,
    })
    expect(progressedAttempt.kind).toBe('progress')
    state = progressedAttempt.state

    let lastAction = progressedAttempt
    for (let attempt = 0; attempt < 8; attempt += 1) {
      lastAction = resolveDirectNavigationAction(state, {
        matchId: 'block-80:0:3',
        progressKey: '39:45:7:visible-segment',
        protyleRef,
      })
      state = lastAction.state
    }

    expect(lastAction.kind).toBe('fallback')
    expect(state.attempts).toBe(0)
    expect(state.matchId).toBe('')
    expect(state.progressKey).toBe('')
  })
})
