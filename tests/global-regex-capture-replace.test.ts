import { describe, expect, it } from 'vitest'
import { computeReplacement } from '@/features/search-replace/global/diff-builder'

describe('regex capture group replace', () => {
  it('supports capture group backreferences $1 $2 in regex mode', () => {
    const original = '2026-10-05'
    const pattern = '(\\d{4})-(\\d{2})-(\\d{2})'
    const replacement = '$1年$2月$3日'

    const res = computeReplacement(original, replacement, {
      useRegex: true,
      query: pattern,
    })

    expect(res).toBe('2026年10月05日')
  })

  it('handles fallback when regex query is invalid', () => {
    const original = 'abc'
    const res = computeReplacement(original, 'def', {
      useRegex: true,
      query: '[invalid(',
    })
    expect(res).toBe('def')
  })
})
