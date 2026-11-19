import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setPluginInstance } from '@/plugin-instance'
import {
  clearPresetsForTesting,
  deletePreset,
  getSavedPresets,
  loadSavedPresets,
  savePreset,
} from '@/features/search-replace/global/saved-presets'

describe('saved-presets', () => {
  beforeEach(() => {
    clearPresetsForTesting()
    setPluginInstance(null as any)
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

  it('does not let a stale disk load wipe out presets saved during persistence', async () => {
    const loadData = vi.fn()
    const saveData = vi.fn(async () => {
      // 模拟保存耗时窗口
      await new Promise(resolve => setTimeout(resolve, 20))
      return null
    })
    setPluginInstance({
      loadData: loadData as any,
      saveData,
    } as any)

    const saving = savePreset('保存中的预设', {
      query: '关键词',
      options: {
        matchCase: false,
        wholeWord: false,
        useRegex: false,
        pinyin: false,
        fuzzy: false,
      },
      filters: {},
    })

    // 保存尚未落盘时重开菜单触发磁盘加载：
    // 修复前磁盘旧态（空列表）会整体覆盖缓存，刚保存的预设消失
    const duringSave = await loadSavedPresets()
    expect(duringSave.map(preset => preset.name)).toEqual(['保存中的预设'])

    await saving
    await loadSavedPresets()
    expect(getSavedPresets().map(preset => preset.name)).toEqual(['保存中的预设'])
  })

  it('loads presets from disk again after a failed persistence', async () => {
    const saveData = vi.fn(async () => {
      throw new Error('disk full')
    })
    const loadData = vi.fn(async () => [
      {
        createdAt: 1,
        filters: {},
        id: 'preset-disk',
        name: '磁盘预设',
        options: {
          matchCase: false,
          wholeWord: false,
          useRegex: false,
          pinyin: false,
          fuzzy: false,
        },
        query: 'disk',
      },
    ])
    setPluginInstance({ loadData, saveData } as any)

    await savePreset('本地新预设', {
      query: 'local',
      options: {
        matchCase: false,
        wholeWord: false,
        useRegex: false,
        pinyin: false,
        fuzzy: false,
      },
      filters: {},
    })

    // 落盘失败后缓存仍持有本地变更（dirty），磁盘数据不会覆盖它
    const list = await loadSavedPresets()
    expect(list.map(preset => preset.name)).toContain('本地新预设')
    expect(list.map(preset => preset.name)).not.toContain('磁盘预设')

    // 落盘成功后 dirty 清除，磁盘加载恢复生效
    saveData.mockResolvedValue(null)
    const preset = getSavedPresets().at(-1)!
    await deletePreset(preset.id)
    const reloaded = await loadSavedPresets()
    expect(reloaded.map(item => item.name)).toEqual(['磁盘预设'])
  })
})
