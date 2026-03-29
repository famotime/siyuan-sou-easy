import {
  getBlockElement,
  getUniqueBlockElements,
} from '../editor'
import { getBlockAttrs } from '../kernel'
import type { EditorContext } from '../types'
import {
  ATTRIBUTE_VIEW_NODE_TYPE,
  type AttributeViewBlockSummary,
} from './search-types'

export function collectAttributeViewBlocks(
  context: EditorContext,
  startingBlockIndex: number,
  documentContent: string,
): AttributeViewBlockSummary[] {
  const fromDocumentContent = collectAttributeViewBlocksFromDocumentContent(context, startingBlockIndex, documentContent)
  if (fromDocumentContent.length > 0) {
    return fromDocumentContent
  }

  return getUniqueBlockElements(context.protyle)
    .filter(element => element.dataset.type === ATTRIBUTE_VIEW_NODE_TYPE)
    .map((element, index) => ({
      avBlockId: element.dataset.nodeId ?? `attribute-view-${index}`,
      avID: element.dataset.avId?.trim() || undefined,
      blockIndex: startingBlockIndex + index,
      element,
      rootId: context.rootId,
      viewID: resolveAttributeViewViewIdFromElement(element),
    }))
}

export async function resolveAttributeViewInfo(attributeViewBlock: AttributeViewBlockSummary) {
  if (attributeViewBlock.avID && attributeViewBlock.viewID) {
    return {
      avID: attributeViewBlock.avID,
      viewID: attributeViewBlock.viewID,
    }
  }

  const blockAttrs = await getBlockAttrs(attributeViewBlock.avBlockId)
  return {
    avID: attributeViewBlock.avID || parseAttributeViewId(blockAttrs),
    viewID: attributeViewBlock.viewID || parseAttributeViewViewId(blockAttrs),
  }
}

function collectAttributeViewBlocksFromDocumentContent(
  context: EditorContext,
  startingBlockIndex: number,
  documentContent: string,
) {
  if (!documentContent.trim()) {
    return []
  }

  const container = document.createElement('div')
  container.innerHTML = documentContent
  const seen = new Set<string>()

  return Array.from(container.querySelectorAll<HTMLElement>(`[data-type="${ATTRIBUTE_VIEW_NODE_TYPE}"][data-node-id]`))
    .filter((element) => {
      const blockId = element.dataset.nodeId
      if (!blockId || seen.has(blockId)) {
        return false
      }

      seen.add(blockId)
      return true
    })
    .map((element, index) => {
      const avBlockId = element.dataset.nodeId ?? `attribute-view-${index}`
      return {
        avBlockId,
        avID: element.dataset.avId?.trim() || undefined,
        blockIndex: startingBlockIndex + index,
        element: getBlockElement(context, avBlockId) ?? element,
        rootId: context.rootId,
        viewID: resolveAttributeViewViewIdFromElement(element),
      }
    })
}

function parseAttributeViewId(blockAttrs: Record<string, string>) {
  const rawValue = blockAttrs['custom-avs']
  if (!rawValue) {
    return ''
  }

  try {
    const parsed = JSON.parse(rawValue)
    if (Array.isArray(parsed)) {
      const firstValue = parsed.find(value => typeof value === 'string' && value.trim())
      return typeof firstValue === 'string' ? firstValue : ''
    }
  } catch {
    const matched = rawValue.match(/\d{14}-[a-z0-9]+/i)
    return matched?.[0] ?? rawValue.trim()
  }

  return ''
}

function parseAttributeViewViewId(blockAttrs: Record<string, string>) {
  return blockAttrs['custom-sy-av-view']?.trim() ?? ''
}

function resolveAttributeViewViewIdFromElement(element: HTMLElement) {
  return element.dataset.avViewId?.trim()
    || element.dataset.syAvView?.trim()
    || element.getAttribute('data-av-view-id')?.trim()
    || element.getAttribute('custom-sy-av-view')?.trim()
    || ''
}
