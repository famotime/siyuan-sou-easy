// @vitest-environment node

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  buildLunariaBusRegistration,
  searchNotesByKeywords,
} from '@/features/search-replace/lunaria-bus'

// RF-112：registerToLunariaBus 抽取后为其注册体与检索执行补单测（此前无测试）

const executeGlobalBlockQueryMock = vi.hoisted(() => vi.fn())

vi.mock('@/features/search-replace/global/kernel-query', () => ({
  executeGlobalBlockQuery: executeGlobalBlockQueryMock,
}))

describe('lunaria bus（RF-112）', () => {
  beforeEach(() => {
    executeGlobalBlockQueryMock.mockReset()
  })

  it('注册体包含 searchNotesByKeywords 工具且 keywords 为必填数组参数', () => {
    const registration = buildLunariaBusRegistration({
      id: 'siyuan-sou-easy',
      name: '搜 easy',
      version: '2.0.0',
    })
    expect(registration.id).toBe('siyuan-sou-easy')
    expect(registration.category).toBe('editor')
    expect(registration.tools).toHaveLength(1)
    const tool = registration.tools[0]!
    expect(tool.name).toBe('searchNotesByKeywords')
    expect((tool.parameters as any).required).toEqual(['keywords'])
    expect((tool.parameters as any).properties.keywords.type).toBe('array')
  })

  it('execute 分发到 searchNotesByKeywords，未知工具抛错', async () => {
    const registration = buildLunariaBusRegistration({
      id: 'p',
      name: 'p',
      version: '1',
    })
    executeGlobalBlockQueryMock.mockResolvedValue([])

    await expect(registration.execute('unknownTool', {})).rejects.toThrow('未知工具: unknownTool')
    await registration.execute('searchNotesByKeywords', { keywords: ['foo'] })
    expect(executeGlobalBlockQueryMock).toHaveBeenCalledTimes(1)
  })

  it('空关键词列表直接返回空数据，不触发检索', async () => {
    const result = await searchNotesByKeywords([], 5)
    expect(result).toEqual({
      success: true,
      code: 200,
      data: [],
    })
    expect(executeGlobalBlockQueryMock).not.toHaveBeenCalled()
  })

  it('全量关键词经 mustInclude AND 组合校验，SQL 预过滤取首个关键词（既有行为）', async () => {
    executeGlobalBlockQueryMock.mockResolvedValue([])
    await searchNotesByKeywords(['深圳', '地铁'], 5)
    expect(executeGlobalBlockQueryMock).toHaveBeenCalledWith('深圳', {}, {
      limit: 100,
      parsedQuery: {
        mustInclude: ['深圳', '地铁'],
        orGroups: [],
        exclude: [],
      },
    })
  })

  it('按 root_id 聚合文档并截断到 limit，hpath 为空时标题回退为未命名笔记', async () => {
    executeGlobalBlockQueryMock.mockResolvedValue([
      {
        id: 'b1',
        root_id: 'doc-1',
        hpath: '/知识库/深圳',
        content: '深圳内容',
      },
      {
        id: 'b2',
        root_id: 'doc-1',
        hpath: '/知识库/深圳',
        content: '深圳第二条不重复收录',
      },
      {
        id: 'b3',
        root_id: 'doc-2',
        hpath: '',
        content: '无路径内容',
      },
      {
        id: 'b4',
        root_id: '',
        content: '无 root_id 也不应有 docId 落库',

      },
    ])
    const result = await searchNotesByKeywords(['kw'], 1)
    expect(result).toEqual({
      success: true,
      code: 200,
      data: [
        {
          docId: 'doc-1',
          title: '深圳',
          snippet: '深圳内容',
          score: 0.9,
        },
      ],
    })

    const resultAll = await searchNotesByKeywords(['kw'], 5)
    const data = (resultAll as any).data
    // root_id 为空时回退到 record.id（b4）——现状行为钉住
    expect(data).toHaveLength(3)
    expect(data[1]).toMatchObject({
      docId: 'doc-2',
      // extractDocTitleFromHpath 的回退值为"未命名文档"，代码中的 || '未命名笔记' 永不生效（现状）
      title: '未命名文档',
      snippet: '无路径内容',
    })
    expect(data[2]).toMatchObject({ docId: 'b4' })
  })
})
