import {
  CODE_NODE_TYPE,
  SUPPORTED_NODE_TYPES,
  TABLE_NODE_TYPE,
} from './constants'
import {
  pickPreferredBlockElement,
  pickPreferredSearchRoot,
} from './block-selection'
import { debugElement, debugLog } from '../debug'
import {
  getTableRowCells,
  getTableRowElements,
} from './table-dom'
import { resolveEditorScrollContainer } from './scroll-container'
import type {
  EditorContext,
  SearchOptions,
  SearchableBlock,
  TableCellSearchMetadata,
  TableSearchMetadata,
} from '../types'

export function collectSearchableBlocks(context: EditorContext, options: SearchOptions): SearchableBlock[] {
  const searchRoot = resolveEditorSearchRoot(context)
  return collectSearchableBlocksFromRoot(searchRoot, context.rootId, options)
}

export function getBlockElement(context: EditorContext, blockId: string) {
  const scrollContainer = resolveEditorScrollContainer(context)
  const preferredSearchRoot = resolveEditorSearchRoot(context)
  const primaryCandidates = Array.from(
    preferredSearchRoot.querySelectorAll<HTMLElement>(`[data-node-id="${blockId}"][data-type]`),
  )
  const fallbackCandidates = primaryCandidates.length > 0
    ? []
    : Array.from(context.protyle.querySelectorAll<HTMLElement>(`[data-node-id="${blockId}"][data-type]`))

  const chosen = pickPreferredBlockElement(
    primaryCandidates.length > 0 ? primaryCandidates : fallbackCandidates,
    scrollContainer,
  )
  if (!chosen || primaryCandidates.length + fallbackCandidates.length > 1) {
    debugLog('get-block-element:resolved', {
      blockId,
      candidates: (primaryCandidates.length > 0 ? primaryCandidates : fallbackCandidates)
        .map(candidate => debugElement(candidate)),
      chosen: debugElement(chosen),
      fallbackCandidateCount: fallbackCandidates.length,
      primaryCandidateCount: primaryCandidates.length,
      rootId: context.rootId,
      usingFallbackCandidates: primaryCandidates.length === 0,
    })
  }

  return chosen
}

export function getBlockPlainText(blockElement: HTMLElement) {
  const textNodes = getSearchTextNodes(blockElement)
  return textNodes.map(node => node.nodeValue ?? '').join('')
}

export function collectSearchableBlocksFromDocumentContent(
  content: string,
  rootId: string,
  options: SearchOptions,
) {
  const container = document.createElement('div')
  container.innerHTML = content
  const searchRoot = resolveSearchRoot(container)
  return collectSearchableBlocksFromRoot(searchRoot, rootId, options)
}

export function createBlockElementFromDom(dom: string) {
  if (!dom.trim()) {
    return null
  }

  const container = document.createElement('div')
  container.innerHTML = dom
  return container.querySelector<HTMLElement>('[data-node-id][data-type]')
    ?? container.firstElementChild as HTMLElement | null
}

export function resolveSearchRoot(root: ParentNode) {
  return root.querySelector<HTMLElement>('.protyle-wysiwyg') ?? root
}

export function resolveEditorSearchRoot(
  context: EditorContext,
  scrollContainer: HTMLElement | null = resolveEditorScrollContainer(context),
) {
  const candidates = Array.from(context.protyle.querySelectorAll<HTMLElement>('.protyle-wysiwyg'))
  const chosen = pickPreferredSearchRoot(candidates, scrollContainer)

  if (chosen) {
    if (candidates.length > 1) {
      debugLog('search-root:resolved', {
        candidates: candidates.map(candidate => debugElement(candidate)),
        chosen: debugElement(chosen),
        rootId: context.rootId,
        scrollContainer: debugElement(scrollContainer),
      })
    }

    return chosen
  }

  return context.protyle
}

export function getUniqueBlockElements(root: ParentNode) {
  const seen = new Set<string>()

  return Array.from(resolveSearchRoot(root).querySelectorAll<HTMLElement>('[data-node-id][data-type]')).filter((element) => {
    const blockId = element.dataset.nodeId
    if (!blockId || seen.has(blockId)) {
      return false
    }

    seen.add(blockId)
    return true
  })
}

export function getBlockTextLength(blockElement: HTMLElement) {
  return getSearchTextNodes(blockElement)
    .reduce((length, node) => length + (node.nodeValue?.length ?? 0), 0)
}

function collectSearchableBlocksFromRoot(root: ParentNode, rootId: string, options: SearchOptions): SearchableBlock[] {
  const blocks: SearchableBlock[] = []
  getUniqueBlockElements(root).forEach((element, blockIndex) => {
    const blockId = element.dataset.nodeId
    const blockType = element.dataset.type
    if (!blockId || !blockType || !isSupportedBlockType(blockType, options)) {
      return
    }

    const tableMetadata = blockType === TABLE_NODE_TYPE
      ? collectTableSearchMetadata(element)
      : null
    const text = tableMetadata?.text ?? getBlockPlainText(element)
    if (!text) {
      return
    }

    blocks.push({
      blockId,
      rootId,
      blockType,
      blockIndex,
      collapsedAncestorIds: resolveCollapsedAncestorIds(element),
      text,
      blockLineCount: countBlockLines(text),
      blockTextLength: text.length,
      element,
      table: tableMetadata?.table,
    })
  })

  return blocks
}

function resolveCollapsedAncestorIds(blockElement: HTMLElement) {
  const collapsedAncestorIds: string[] = []
  let currentAncestor = blockElement.parentElement?.closest<HTMLElement>('[data-node-id][data-type]')

  while (currentAncestor) {
    const ancestorId = currentAncestor.dataset.nodeId?.trim()
    if (ancestorId && currentAncestor.getAttribute('fold') === '1') {
      collapsedAncestorIds.unshift(ancestorId)
    }

    currentAncestor = currentAncestor.parentElement?.closest<HTMLElement>('[data-node-id][data-type]')
  }

  return collapsedAncestorIds
}

function collectTableSearchMetadata(blockElement: HTMLElement): { text: string, table?: TableSearchMetadata } | null {
  const rows = getTableRowElements(blockElement)
  if (!rows.length) {
    return null
  }

  const cells: TableCellSearchMetadata[] = []
  const cellTexts: string[] = []
  let columnCount = 0
  let cursor = 0

  rows.forEach((row, rowIndex) => {
    const rowCells = getTableRowCells(row)
    columnCount = Math.max(columnCount, rowCells.length)

    rowCells.forEach((cell, columnIndex) => {
      const cellText = getTableCellPlainText(cell)
      if (!cellText.length) {
        return
      }

      cells.push({
        cellId: cell.dataset.nodeId ?? '',
        rowIndex,
        columnIndex,
        start: cursor,
        end: cursor + cellText.length,
      })
      cellTexts.push(cellText)
      cursor += cellText.length
    })
  })

  if (!cells.length) {
    return null
  }

  return {
    text: cellTexts.join(''),
    table: {
      rowCount: rows.length,
      columnCount,
      cells,
    },
  }
}

function getTableCellPlainText(cell: HTMLElement) {
  const editableText = getBlockPlainText(cell)
  if (editableText.length > 0) {
    return editableText
  }

  const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!(node instanceof Text) || !node.nodeValue?.trim()) {
        return NodeFilter.FILTER_REJECT
      }

      const parentElement = node.parentElement
      if (!parentElement || parentElement.closest('.protyle-attr, .fn__none, svg, style, script')) {
        return NodeFilter.FILTER_REJECT
      }

      return NodeFilter.FILTER_ACCEPT
    },
  })

  const textParts: string[] = []
  let currentNode = walker.nextNode()
  while (currentNode) {
    textParts.push((currentNode as Text).nodeValue ?? '')
    currentNode = walker.nextNode()
  }

  return textParts.join('')
}

export function getOwnedTextNodes(blockElement: HTMLElement) {
  const editableRoots = getEditableRoots(blockElement)
  if (!editableRoots.length) {
    return []
  }

  return editableRoots.flatMap(root => collectTextNodes(root, blockElement))
}

export function getSearchTextNodes(blockElement: HTMLElement) {
  const editableRoots = getEditableRoots(blockElement)
  if (editableRoots.length) {
    return editableRoots.flatMap(root => collectTextNodes(root, blockElement))
  }

  return collectTextNodes(blockElement, blockElement, { ignoreWhitespaceOnly: true })
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

function collectTextNodes(
  root: HTMLElement,
  ownerBlock: HTMLElement,
  options?: { ignoreWhitespaceOnly?: boolean },
) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!(node instanceof Text) || !node.nodeValue?.length) {
        return NodeFilter.FILTER_REJECT
      }

      if (options?.ignoreWhitespaceOnly && !node.nodeValue.trim()) {
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

function countBlockLines(text: string) {
  if (!text.length) {
    return 0
  }

  let lineCount = 1
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') {
      lineCount += 1
    }
  }
  return lineCount
}
