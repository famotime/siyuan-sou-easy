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
  const merged: AttributeViewCellCandidate[] = []
  const seen = new Set<string>()

  ;[...domCandidates, ...renderedCandidates].forEach((candidate) => {
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
  const rowIdentity = candidate.itemID ?? candidate.rowID ?? ''
  const columnIdentity = resolveAttributeViewColumnIdentity(candidate)

  if (candidate.targetKind === 'cell') {
    return [
      candidate.targetKind,
      rowIdentity,
      columnIdentity,
      candidate.text,
    ].join('::')
  }

  if (candidate.targetKind === 'column-header') {
    return [
      candidate.targetKind,
      columnIdentity,
      candidate.text,
    ].join('::')
  }

  return [
    candidate.targetKind,
    candidate.text,
  ].join('::')
}

function resolveAttributeViewColumnIdentity(candidate: AttributeViewCellCandidate) {
  if (typeof candidate.columnIndex === 'number') {
    return `col:${candidate.columnIndex}`
  }

  const normalizedKeyID = candidate.keyID.trim()
  if (normalizedKeyID && !normalizedKeyID.startsWith('__dom-col-')) {
    return normalizedKeyID
  }

  return normalizedKeyID || candidate.columnName.trim()
}
