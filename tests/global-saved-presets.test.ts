import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearPresetsForTesting,
  deletePreset,
  getSavedPresets,
  savePreset,
} from '@/features/search-replace/global/saved-presets'

describe('saved-presets', () => {
  beforeEach(() => {
    clearPresetsForTesting()
  })

  it('saves and deletes a search preset', async () => {
    const preset = await savePreset('我的常用检索', {
      query: 'path:日记 tag:工作 待办',
      replacement: '已完成',
      options: {
        matchCase: false,
        wholeWord: false,
        useRegex: false,
        pinyin: false,
        fuzzy: false,
      },
      filters: {
        tags: ['工作'],
        types: ['p'],
      },
    })

    expect(preset.id).toBeDefined()
    expect(preset.name).toBe('我的常用检索')

    const list = getSavedPresets()
    expect(list).toHaveLength(1)
    expect(list[0].query).toContain('待办')

    const deleted = await deletePreset(preset.id)
    expect(deleted).toBe(true)
    expect(getSavedPresets()).toHaveLength(0)
  })
})
