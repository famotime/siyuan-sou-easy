import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  buildAttributeViewCandidateSignature,
  mergeAttributeViewSearchCandidates,
  shouldReturnDomCandidatesOnly,
  shouldUseRenderedAttributeViewCandidates,
} from '@/features/search-replace/attribute-view/search-candidate-policy'

describe('attribute view candidate policy helpers', () => {
  it('returns DOM candidates only when a visible cell candidate already exists', () => {
    expect(shouldReturnDomCandidatesOnly([
      {
        avBlockId: 'av-1',
        avID: 'av-1',
        keyID: 'col-1',
        targetKind: 'cell',
        text: 'visible',
      },
    ])).toBe(true)
  })

  it('rejects rendered fallback when the API view id or view type does not match the active view', () => {
    expect(shouldUseRenderedAttributeViewCandidates({
      attributeViewTypeHint: 'kanban',
      renderedAttributeView: {
        viewID: 'table-view',
        viewType: 'table',
      },
      requestedViewID: 'kanban-view',
    })).toBe(false)
  })

  it('deduplicates merged rendered candidates by stable candidate signature', () => {
    const domCandidate = {
      avBlockId: 'av-1',
      avID: 'av-1',
      itemID: 'item-1',
      keyID: 'col-1',
      rowID: 'item-1',
      targetKind: 'cell' as const,
      text: 'Alpha',
    }
    const duplicateRenderedCandidate = {
      ...domCandidate,
    }
    const newRenderedCandidate = {
      ...domCandidate,
      keyID: 'col-2',
      text: 'Beta',
    }

    expect(buildAttributeViewCandidateSignature(domCandidate)).toBe('cell::item-1::item-1::col-1::Alpha')
    expect(mergeAttributeViewSearchCandidates([domCandidate], [
      duplicateRenderedCandidate,
      newRenderedCandidate,
    ])).toEqual([
      domCandidate,
      newRenderedCandidate,
    ])
  })
})
