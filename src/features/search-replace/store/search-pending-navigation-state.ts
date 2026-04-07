interface ApproximateNavigationProgress {
  lowerBoundaryAttempts: number
  previousKey: string
  stalledAttempts: number
  upperBoundaryAttempts: number
}

interface ApproximateNavigationResult {
  key: string
  waitingAtLowerBoundary: boolean
  waitingAtUpperBoundary: boolean
}

interface DirectNavigationProgress<ProtyleRef = unknown> {
  attempts: number
  matchId: string
  progressKey: string
  protyleRef: ProtyleRef | null
}

type DirectNavigationActionKind = 'fallback' | 'progress' | 'start' | 'wait'

interface ResolveDirectNavigationActionResult<ProtyleRef = unknown> {
  kind: DirectNavigationActionKind
  state: DirectNavigationProgress<ProtyleRef>
}

const LOWER_BOUNDARY_TIMEOUT_ATTEMPTS = 200
const STALLED_TIMEOUT_ATTEMPTS = 40
const UPPER_BOUNDARY_TIMEOUT_ATTEMPTS = 200
const DIRECT_NAVIGATION_MAX_STALLED_ATTEMPTS = 8

export function createApproximateNavigationProgress(): ApproximateNavigationProgress {
  return {
    lowerBoundaryAttempts: 0,
    previousKey: '',
    stalledAttempts: 0,
    upperBoundaryAttempts: 0,
  }
}

export function resetApproximateNavigationProgress(): ApproximateNavigationProgress {
  return createApproximateNavigationProgress()
}

export function advanceApproximateNavigationProgress(
  previous: ApproximateNavigationProgress,
  result: ApproximateNavigationResult,
): ApproximateNavigationProgress {
  if (result.key !== previous.previousKey) {
    return {
      lowerBoundaryAttempts: result.waitingAtLowerBoundary ? 1 : 0,
      previousKey: result.key,
      stalledAttempts: 1,
      upperBoundaryAttempts: result.waitingAtUpperBoundary ? 1 : 0,
    }
  }

  if (result.waitingAtLowerBoundary) {
    return {
      ...previous,
      lowerBoundaryAttempts: previous.lowerBoundaryAttempts + 1,
    }
  }

  if (result.waitingAtUpperBoundary) {
    return {
      ...previous,
      upperBoundaryAttempts: previous.upperBoundaryAttempts + 1,
    }
  }

  return {
    ...previous,
    stalledAttempts: previous.stalledAttempts + 1,
  }
}

export function resolveApproximateNavigationTimeoutReason(
  progress: ApproximateNavigationProgress,
) {
  if (progress.lowerBoundaryAttempts >= LOWER_BOUNDARY_TIMEOUT_ATTEMPTS) {
    return 'lower-boundary-timeout'
  }

  if (progress.upperBoundaryAttempts >= UPPER_BOUNDARY_TIMEOUT_ATTEMPTS) {
    return 'upper-boundary-timeout'
  }

  if (progress.stalledAttempts >= STALLED_TIMEOUT_ATTEMPTS) {
    return 'stalled-timeout'
  }

  return null
}

export function createDirectNavigationProgress<ProtyleRef = unknown>(): DirectNavigationProgress<ProtyleRef> {
  return {
    attempts: 0,
    matchId: '',
    progressKey: '',
    protyleRef: null,
  }
}

export function resetDirectNavigationProgress<ProtyleRef = unknown>(): DirectNavigationProgress<ProtyleRef> {
  return createDirectNavigationProgress<ProtyleRef>()
}

export function resolveDirectNavigationAction<ProtyleRef = unknown>(
  previous: DirectNavigationProgress<ProtyleRef>,
  {
    matchId,
    progressKey,
    protyleRef,
  }: {
    matchId: string
    progressKey: string
    protyleRef: ProtyleRef
  },
): ResolveDirectNavigationActionResult<ProtyleRef> {
  const nextState = {
    attempts: previous.attempts,
    matchId,
    progressKey,
    protyleRef,
  }
  const isNewAttempt = previous.matchId !== matchId || previous.protyleRef !== protyleRef

  if (isNewAttempt) {
    return {
      kind: 'start',
      state: {
        ...nextState,
        attempts: 1,
      },
    }
  }

  if (previous.progressKey !== progressKey) {
    return {
      kind: 'progress',
      state: {
        ...nextState,
        attempts: 1,
      },
    }
  }

  const attempts = previous.attempts + 1
  if (attempts <= DIRECT_NAVIGATION_MAX_STALLED_ATTEMPTS) {
    return {
      kind: 'wait',
      state: {
        ...nextState,
        attempts,
      },
    }
  }

  return {
    kind: 'fallback',
    state: resetDirectNavigationProgress<ProtyleRef>(),
  }
}

export type {
  ApproximateNavigationProgress,
  ApproximateNavigationResult,
  DirectNavigationProgress,
  ResolveDirectNavigationActionResult,
}
