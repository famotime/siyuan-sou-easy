import { beforeEach, describe, expect, it } from 'vitest'
import { setPluginInstance } from '@/plugin-instance'
import { canTriggerNativeMatchNavigation } from '@/features/search-replace/native-navigation'
import type { SearchMatch } from '@/features/search-replace/types'

function createMatch(overrides: Partial<SearchMatch>): SearchMatch {
  return {
    blockId: '20260101120000-abc1234',
    blockIndex: 0,
    blockType: 'NodeParagraph',
    end: 3,
    id: '20260101120000-abc1234:0:3',
    matchedText: 'foo',
    previewText: '[foo]',
    replaceable: true,
    rootId: 'root-1',
    start: 0, occ: 0,
    ...overrides,
  }
}

describe('native navigation guard', () => {
  beforeEach(() => {
    setPluginInstance({
      app: { appId: 'app-1' },
      name: 'siyuan-sou-easy',
    } as any)
  })

  it('allows real protyle blocks to trigger native navigation', () => {
    expect(canTriggerNativeMatchNavigation(createMatch({}))).toBe(true)
    expect(canTriggerNativeMatchNavigation(createMatch({ sourceKind: 'block' }))).toBe(true)
  })

  it('rejects synthetic block ids from terminal surfaces', () => {
    const terminalMatch = createMatch({
      blockId: 'surface-1:3',
      sourceKind: 'terminal',
    })
    // 合成 id 传入 openTab(removeCurrentTab:true) 会打开不存在的文档并移除当前页签
    expect(canTriggerNativeMatchNavigation(terminalMatch)).toBe(false)
  })

  it('rejects synthetic block ids from canvas nodes', () => {
    const canvasMatch = createMatch({
      blockId: 'canvas:node:f1',
      sourceKind: 'canvas',
    })
    expect(canTriggerNativeMatchNavigation(canvasMatch)).toBe(false)
  })

  it('rejects attribute view matches', () => {
    const avMatch = createMatch({
      blockId: 'av-block-1',
      sourceKind: 'attribute-view',
    })
    expect(canTriggerNativeMatchNavigation(avMatch)).toBe(false)
  })

  it('rejects matches without plugin app or block id', () => {
    setPluginInstance(null as any)
    expect(canTriggerNativeMatchNavigation(createMatch({}))).toBe(false)

    setPluginInstance({ app: { appId: 'app-1' } } as any)
    expect(canTriggerNativeMatchNavigation(createMatch({ blockId: '  ' }))).toBe(false)
  })
})
