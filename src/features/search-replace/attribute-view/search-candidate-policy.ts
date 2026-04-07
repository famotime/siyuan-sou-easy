import type {
  AttributeViewCellCandidate,
} from './search-types'

export function shouldReturnDomCandidatesOnly(domCandidates: AttributeViewCellCandidate[]) {
  return domCandidates.some(candidate => candidate.targetKind === 'cell')
}

export function shouldUseRenderedAttributeViewCandidates({
  attributeViewTypeHint,
  renderedAttributeView,
  requestedViewID,
}: {
  attributeViewTypeHint?: string
  renderedAttributeView: any
  requestedViewID?: string
}) {
  const normalizedRequestedViewID = requestedViewID?.trim()
  const normalizedRenderedViewID = String(
    renderedAttributeView?.viewID
    ?? renderedAttributeView?.view?.id
    ?? '',
  ).trim()
  if (
    normalizedRequestedViewID
    && normalizedRenderedViewID
    && normalizedRequestedViewID !== normalizedRenderedViewID
  ) {
    return false
  }

  const normalizedAttributeViewTypeHint = attributeViewTypeHint?.trim().toLowerCase() ?? ''
  const renderedViewType = String(
    renderedAttributeView?.viewType
    ?? renderedAttributeView?.view?.type
    ?? '',
  ).trim().toLowerCase()
  if (normalizedAttributeViewTypeHint && renderedViewType && normalizedAttributeViewTypeHint !== renderedViewType) {
    return false
  }

  return true
}

export function mergeAttributeViewSearchCandidates(
  domCandidates: AttributeViewCellCandidate[],
  renderedCandidates: AttributeViewCellCandidate[],
) {
  const merged = [...domCandidates]
  const seen = new Set(domCandidates.map(buildAttributeViewCandidateSignature))

  renderedCandidates.forEach((candidate) => {
    const signature = buildAttributeViewCandidateSignature(candidate)
    if (seen.has(signature)) {
      return
    }

    seen.add(signature)
    merged.push(candidate)
  })

  return merged
}

export function buildAttributeViewCandidateSignature(candidate: AttributeViewCellCandidate) {
  return [
    candidate.targetKind,
    candidate.itemID ?? '',
    candidate.rowID ?? '',
    candidate.keyID,
    candidate.text,
  ].join('::')
}
