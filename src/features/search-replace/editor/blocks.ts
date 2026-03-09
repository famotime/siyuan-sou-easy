import {
  CODE_NODE_TYPE,
  SUPPORTED_NODE_TYPES,
  TABLE_NODE_TYPE,
} from './constants'
import type {
  EditorContext,
  SearchOptions,
  SearchableBlock,
} from '../types'

export function collectSearchableBlocks(context: EditorContext, options: SearchOptions): SearchableBlock[] {
  const blockElements = Array.from(
    context.protyle.querySelectorAll<HTMLElement>('.protyle-wysiwyg [data-node-id][data-type]'),
  )
  const blocks: SearchableBlock[] = []
  const seen = new Set<string>()

  blockElements.forEach((element, blockIndex) => {
    const blockId = element.dataset.nodeId
    const blockType = element.dataset.type
    if (!blockId || !blockType || seen.has(blockId) || !isSupportedBlockType(blockType, options)) {
      return
    }

    const text = getBlockPlainText(element)
    if (!text) {
      return
    }

    seen.add(blockId)
    blocks.push({
      blockId,
      rootId: context.rootId,
      blockType,
      blockIndex,
      text,
      element,
    })
  })

  return blocks
}

export function getBlockElement(context: EditorContext, blockId: string) {
  return context.protyle.querySelector<HTMLElement>(`.protyle-wysiwyg [data-node-id="${blockId}"][data-type]`)
    ?? context.protyle.querySelector<HTMLElement>(`[data-node-id="${blockId}"][data-type]`)
    ?? context.protyle.querySelector<HTMLElement>(`[data-node-id="${blockId}"]`)
}

export function getBlockPlainText(blockElement: HTMLElement) {
  const textNodes = getOwnedTextNodes(blockElement)
  return textNodes.map(node => node.nodeValue ?? '').join('')
}

export function getOwnedTextNodes(blockElement: HTMLElement) {
  const editableRoots = getEditableRoots(blockElement)
  if (!editableRoots.length) {
    return []
  }

  return editableRoots.flatMap(root => collectTextNodes(root, blockElement))
}

function isSupportedBlockType(blockType: string, options: SearchOptions) {
  if (SUPPORTED_NODE_TYPES.has(blockType)) {
    return true
  }

  return options.includeCodeBlock && blockType === CODE_NODE_TYPE
}

function getEditableRoots(blockElement: HTMLElement) {
  const candidates = Array.from(blockElement.querySelectorAll<HTMLElement>('[contenteditable="true"]'))
  return candidates.filter((candidate) => {
    if (candidate.closest('.protyle-attr')) {
      return false
    }

    return isOwnedByBlock(candidate, blockElement)
  })
}

function collectTextNodes(root: HTMLElement, ownerBlock: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!(node instanceof Text) || !node.nodeValue?.length) {
        return NodeFilter.FILTER_REJECT
      }

      const parentElement = node.parentElement
      if (!parentElement || parentElement.closest('.protyle-attr')) {
        return NodeFilter.FILTER_REJECT
      }

      if (!isOwnedByBlock(parentElement, ownerBlock)) {
        return NodeFilter.FILTER_REJECT
      }

      return NodeFilter.FILTER_ACCEPT
    },
  })

  const textNodes: Text[] = []
  let currentNode = walker.nextNode()
  while (currentNode) {
    textNodes.push(currentNode as Text)
    currentNode = walker.nextNode()
  }

  return textNodes
}

function getOwnerBlock(element: Element) {
  return element.closest<HTMLElement>('[data-node-id][data-type]')
}

function isOwnedByBlock(element: Element, ownerBlock: HTMLElement) {
  const nearestBlock = getOwnerBlock(element)
  if (nearestBlock === ownerBlock) {
    return true
  }

  return ownerBlock.dataset.type === TABLE_NODE_TYPE
    && Boolean(nearestBlock && ownerBlock.contains(nearestBlock))
}
