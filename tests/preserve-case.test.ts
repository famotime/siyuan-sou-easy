import { describe, expect, it } from 'vitest'
import { preserveReplacementCase } from '@/features/search-replace/preserve-case'

describe('preserveReplacementCase', () => {
  it('converts replacement to uppercase for uppercase matches', () => {
    expect(preserveReplacementCase('value', 'VALUE')).toBe('VALUE')
  })

  it('converts replacement to lowercase for lowercase matches', () => {
    expect(preserveReplacementCase('Value', 'value')).toBe('value')
  })

  it('capitalizes each word for title-cased matches', () => {
    expect(preserveReplacementCase('new value', 'Old Value')).toBe('New Value')
  })

  it('keeps original replacement for mixed-case matches', () => {
    expect(preserveReplacementCase('newValue', 'oLdValue')).toBe('newValue')
  })
})
