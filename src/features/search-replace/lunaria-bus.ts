import { extractDocTitleFromHpath } from './global/doc-aggregator'
import { executeGlobalBlockQuery } from './global/kernel-query'

// 拆分自 index.ts 的 registerToLunariaBus（RF-112）：Lunaria 工具总线注册体与
// searchNotesByKeywords 的检索执行。window 事件监听仍由 index.ts 编排。

export interface LunariaBusRegistration {
  id: string
  name: string
  version: string
  category: string
  tools: Array<{
    name: string
    description: string
    parameters: Record<string, unknown>
  }>
  execute: (toolName: string, params: any) => Promise<unknown>
}

export function buildLunariaBusRegistration({
  id,
  name,
  version,
}: {
  id: string
  name: string
  version: string
}): LunariaBusRegistration {
  return {
    id,
    name,
    version,
    category: 'editor',
    tools: [
      {
        name: 'searchNotesByKeywords',
        // 注意（RF-112 语义说明）：keywords 全量作为 mustInclude AND 过滤参与
        // 结果聚合；SQL 预过滤仅取第一个关键词做初筛（既有行为，见
        // searchNotesByKeywords），两个层面的分工由 mustInclude 保证语义完整。
        description: '根据关键词列表（AND 组合过滤）检索知识库相关笔记及段落片段',
        parameters: {
          type: 'object',
          properties: {
            keywords: {
              type: 'array',
              items: { type: 'string' },
              description: '待检索的关键词列表（多词按 AND 组合）',
            },
            limit: {
              type: 'number',
              description: '最大返回文档数量，默认 5',
            },
          },
          required: ['keywords'],
        },
      },
    ],
    execute: async (toolName: string, params: any) => {
      if (toolName === 'searchNotesByKeywords') {
        const keywords: string[] = Array.isArray(params?.keywords) ? params.keywords : []
        const limit = typeof params?.limit === 'number' ? params.limit : 5
        return searchNotesByKeywords(keywords, limit)
      }
      throw new Error(`未知工具: ${toolName}`)
    },
  }
}

export async function searchNotesByKeywords(keywords: string[], limit: number) {
  if (keywords.length === 0) {
    return {
      success: true,
      code: 200,
      data: [],
    }
  }

  // SQL 预过滤仅取第一个关键词（既有行为）；全量关键词经 mustInclude AND 组合校验
  const searchKeyword = keywords[0] || ''
  const records = await executeGlobalBlockQuery(searchKeyword, {}, {
    limit: 100,
    parsedQuery: {
      mustInclude: keywords,
      orGroups: [],
      exclude: [],
    },
  })
  const docMap = new Map<string, { docId: string, title: string, snippet: string, score: number }>()
  for (const record of records) {
    const docId = record.root_id || record.id
    if (!docId) continue
    const docTitle = extractDocTitleFromHpath(record.hpath || '') || '未命名笔记'
    const content = (record.content || record.fcontent || '').trim()
    if (!docMap.has(docId)) {
      docMap.set(docId, {
        docId,
        title: docTitle,
        snippet: content.slice(0, 120),
        score: 0.9,
      })
    }
    if (docMap.size >= limit) break
  }
  return {
    success: true,
    code: 200,
    data: Array.from(docMap.values()),
  }
}
