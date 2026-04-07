type UsableRect = DOMRect | DOMRectReadOnly

export function pickPreferredBlockElement(
  candidates: HTMLElement[],
  scrollContainer: HTMLElement | null,
) {
  const usableCandidates = candidates.filter(candidate => !candidate.closest('.fn__none, .protyle-attr'))
  if (!usableCandidates.length) {
    return null
  }

  const renderableCandidates = usableCandidates
    .map((element) => {
      const rect = element.getBoundingClientRect()
      if (!hasUsableRect(rect)) {
        return null
      }

      return { element, rect }
    })
    .filter((entry): entry is { element: HTMLElement, rect: UsableRect } => Boolean(entry))

  if (!renderableCandidates.length) {
    return usableCandidates[0] ?? null
  }

  const containerRect = scrollContainer?.getBoundingClientRect()
  if (!containerRect || !hasUsableRect(containerRect)) {
    return renderableCandidates[0]?.element ?? usableCandidates[0] ?? null
  }

  const intersectingCandidates = renderableCandidates.filter(({ rect }) => (
    rect.bottom > containerRect.top
    && rect.top < containerRect.bottom
  ))
  if (intersectingCandidates.length) {
    return pickClosestBlockElement(intersectingCandidates, containerRect)
  }

  return pickClosestBlockElement(renderableCandidates, containerRect)
}

export function pickPreferredSearchRoot(
  candidates: HTMLElement[],
  scrollContainer: HTMLElement | null,
  viewportRect: DOMRectReadOnly = createViewportRect(),
) {
  const usableCandidates = candidates.filter(candidate => (
    candidate.isConnected
    && !candidate.closest('.fn__none, .protyle-attr')
  ))
  if (!usableCandidates.length) {
    return null
  }

  if (usableCandidates.length === 1) {
    return usableCandidates[0] ?? null
  }

  const containerRect = scrollContainer?.getBoundingClientRect()
  const referenceRect = hasUsableRect(containerRect) ? containerRect : viewportRect
  const preferLatestTransitionRoot = scrollContainer?.classList.contains('protyle-content--transition') ?? false

  return usableCandidates
    .map((element, domOrder) => {
      const rect = element.getBoundingClientRect()
      const intersectsReference = hasUsableRect(rect)
        && rect.bottom > referenceRect.top
        && rect.top < referenceRect.bottom
        && rect.right > referenceRect.left
        && rect.left < referenceRect.right

      return {
        blockCount: element.querySelectorAll('[data-node-id][data-type]').length,
        distanceToReferenceCenter: resolveRectCenterDistance(rect, referenceRect),
        domOrder,
        element,
        intersectsReference,
      }
    })
    .sort((left, right) => {
      if (left.intersectsReference !== right.intersectsReference) {
        return left.intersectsReference ? -1 : 1
      }

      if (preferLatestTransitionRoot && left.domOrder !== right.domOrder) {
        return right.domOrder - left.domOrder
      }

      if (left.distanceToReferenceCenter !== right.distanceToReferenceCenter) {
        return left.distanceToReferenceCenter - right.distanceToReferenceCenter
      }

      if (left.blockCount !== right.blockCount) {
        return right.blockCount - left.blockCount
      }

      return 0
    })[0]?.element ?? null
}

export function hasUsableRect(rect: DOMRect | DOMRectReadOnly | null | undefined): rect is UsableRect {
  if (!rect) {
    return false
  }

  return Number.isFinite(rect.top)
    && Number.isFinite(rect.bottom)
    && Number.isFinite(rect.left)
    && Number.isFinite(rect.right)
    && (rect.width > 0 || rect.height > 0)
}

export function createViewportRect(): DOMRectReadOnly {
  return {
    bottom: window.innerHeight,
    height: window.innerHeight,
    left: 0,
    right: window.innerWidth,
    top: 0,
    width: window.innerWidth,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }
}

export function resolveRectCenterDistance(
  rect: DOMRect | DOMRectReadOnly | null | undefined,
  referenceRect: DOMRect | DOMRectReadOnly,
) {
  if (!hasUsableRect(rect)) {
    return Number.POSITIVE_INFINITY
  }

  const rectCenterY = (rect.top + rect.bottom) / 2
  const rectCenterX = (rect.left + rect.right) / 2
  const referenceCenterY = (referenceRect.top + referenceRect.bottom) / 2
  const referenceCenterX = (referenceRect.left + referenceRect.right) / 2

  return Math.abs(rectCenterY - referenceCenterY) + Math.abs(rectCenterX - referenceCenterX)
}

function pickClosestBlockElement(
  candidates: Array<{ element: HTMLElement, rect: UsableRect }>,
  containerRect: DOMRect | DOMRectReadOnly,
) {
  const containerCenter = (containerRect.top + containerRect.bottom) / 2

  return candidates
    .slice()
    .sort((left, right) => {
      const leftCenter = (left.rect.top + left.rect.bottom) / 2
      const rightCenter = (right.rect.top + right.rect.bottom) / 2
      return Math.abs(leftCenter - containerCenter) - Math.abs(rightCenter - containerCenter)
    })[0]?.element ?? null
}
