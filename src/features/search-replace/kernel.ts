import {
  fetchSyncPost,
  showMessage,
} from 'siyuan'
import type { DocumentContentSnapshot } from './types'

export async function requestApi<T>(url: string, data?: unknown): Promise<T> {
  const response = await fetchSyncPost(url, data)
  if (response.code !== 0) {
    const message = response.msg || `Request failed: ${url}`
    showMessage(message, 5000, 'error')
    throw new Error(message)
  }

  return response.data as T
}

export async function updateDomBlock(id: string, data: string) {
  return requestApi('/api/block/updateBlock', {
    dataType: 'dom',
    data,
    id,
  })
}

export async function getDocumentContent(id: string) {
  return requestApi<DocumentContentSnapshot>('/api/filetree/getDoc', {
    id,
    mode: 3,
    size: 102400,
  })
}

export async function getBlockDoms(ids: string[]) {
  if (!ids.length) {
    return {}
  }

  return requestApi<Record<string, string>>('/api/block/getBlockDOMs', {
    ids,
  })
}

export async function getBlockAttrs(id: string) {
  return requestApi<Record<string, string>>('/api/attr/getBlockAttrs', {
    id,
  })
}

export async function renderAttributeView(id: string, viewID?: string) {
  const payload: Record<string, unknown> = {
    id,
    pageSize: 200,
    query: '',
  }
  if (viewID?.trim()) {
    payload.viewID = viewID.trim()
  }

  return requestApi<any>('/api/av/renderAttributeView', payload)
}

export async function getAttributeViewKeysByAvID(avID: string) {
  return requestApi<Array<Record<string, any>>>('/api/av/getAttributeViewKeysByAvID', {
    avID,
  })
}
