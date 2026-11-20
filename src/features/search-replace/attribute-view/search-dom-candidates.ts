import type {
  AttributeViewBlockSummary,
  AttributeViewCellCandidate,
} from './search-types'

export function extractDomAttributeViewSearchCandidates({
  attributeViewBlock,
  avID,
}: {
  attributeViewBlock: AttributeViewBlockSummary
  avID: string
}) {
  const blockElement = attributeViewBlock.element
  if (!blockElement.isConnected) {
    return []
  }

  const titleCandidates = collectDomAttributeViewTitleCandidates({
    attributeViewBlock,
    avID,
    blockElement,
  })
  const headerInfo = resolveDomAttributeViewHeaderInfo(blockElement)
  const headerCandidates = collectDomAttributeViewHeaderCandidates({
    attributeViewBlock,
    avID,
    headerInfo,
  })
  const groupTitleCandidates = collectDomAttributeViewGroupTitleCandidates({
    attributeViewBlock,
    avID,
    blockElement,
  })
  const rowCandidates = collectDomAttributeViewRowCandidates({
    attributeViewBlock,
    avID,
    blockElement,
    headerInfo,
  })

  return [
    ...titleCandidates,
    ...headerCandidates,
    ...groupTitleCandidates,
    ...rowCandidates,
  ]
    .sort((left, right) => compareDomCandidateOrder(left.sourceElement, right.sourceElement))
    .map(({ candidate }) => candidate)
}

function collectDomAttributeViewTitleCandidates({
  attributeViewBlock,
  avID,
  blockElement,
}: {
  attributeViewBlock: AttributeViewBlockSummary
  avID: string
  blockElement: HTMLElement
}) {
  const seen = new Set<string>()
  return Array.from(blockElement.querySelectorAll<HTMLElement>(
    '.av__title, .av__title-text, .av__header-title, .av__name',
  ))
    .filter(isVisibleAttributeViewElement)
    .flatMap((element, index) => {
      const text = getAttributeViewDomText(element)
      if (!text || seen.has(text)) {
        return []
      }

      seen.add(text)
      return [createOrderedCandidate(element, {
        avBlockId: attributeViewBlock.avBlockId,
        avID,
        columnName: text,
        keyID: `__dom-view-name-${index}__`,
        text,
        targetKind: 'view-name' as const,
      })]
    })
}

function collectDomAttributeViewHeaderCandidates({
  attributeViewBlock,
  avID,
  headerInfo,
}: {
  attributeViewBlock: AttributeViewBlockSummary
  avID: string
  headerInfo: DomAttributeViewHeaderInfo
}) {
  return headerInfo.headers
    .filter(({ emitCandidate }) => emitCandidate)
    .map(({
      cell,
      columnIndex,
      keyID,
      text,
    }) => (
      createOrderedCandidate(cell, {
        avBlockId: attributeViewBlock.avBlockId,
        avID,
        columnName: text,
        columnIndex,
        keyID,
        text,
        targetKind: 'column-header' as const,
      })
    ))
}

function collectDomAttributeViewGroupTitleCandidates({
  attributeViewBlock,
  avID,
  blockElement,
}: {
  attributeViewBlock: AttributeViewBlockSummary
  avID: string
  blockElement: HTMLElement
}) {
  const seen = new Set<string>()
  return Array.from(blockElement.querySelectorAll<HTMLElement>(
    '.av__group-title, .av__group-name, .av__group-label',
  ))
    .filter(isVisibleAttributeViewElement)
    .flatMap((element, index) => {
      const text = getAttributeViewDomText(element)
      if (!text || seen.has(text)) {
        return []
      }

      seen.add(text)
      return [createOrderedCandidate(element, {
        avBlockId: attributeViewBlock.avBlockId,
        avID,
        columnName: text,
        keyID: `__dom-group-title-${index}__`,
        text,
        targetKind: 'group-title' as const,
      })]
    })
}

function collectDomAttributeViewRowCandidates({
  attributeViewBlock,
  avID,
  blockElement,
  headerInfo,
}: {
  attributeViewBlock: AttributeViewBlockSummary
  avID: string
  blockElement: HTMLElement
  headerInfo: DomAttributeViewHeaderInfo
}) {
  const groups = normalizeDomAttributeViewRowGroups({
    blockElement,
    headerInfo,
  })

  return groups.flatMap((group) => (
    group.candidates.map((candidate) => createOrderedCandidate(group.sourceElement, {
      avBlockId: attributeViewBlock.avBlockId,
      avID,
      columnName: candidate.columnName,
      columnIndex: candidate.columnIndex,
      itemID: group.rowID,
      keyID: candidate.keyID,
      rowID: group.rowID,
      rowLabel: group.rowLabel,
      text: candidate.text,
      targetKind: 'cell' as const,
    }))
  ))
}

interface DomAttributeViewHeader {
  cell: HTMLElement
  columnIndex: number
  emitCandidate: boolean
  keyID: string
  text: string
}

interface DomAttributeViewHeaderInfo {
  headers: DomAttributeViewHeader[]
  keyedColumnIndexByKeyID: Map<string, number>
  headerNameByColumnIndex: Map<number, string>
  headerNameByKeyID: Map<string, string>
}

interface DomAttributeViewNormalizedRowCandidate {
  columnIndex: number
  columnName: string
  keyID: string
  text: string
}

interface DomAttributeViewNormalizedRowGroup {
  candidates: DomAttributeViewNormalizedRowCandidate[]
  rowID?: string
  rowLabel?: string
  sourceElement: HTMLElement
}

function resolveDomAttributeViewHeaderInfo(blockElement: HTMLElement): DomAttributeViewHeaderInfo {
  const keyedColumnIndexByKeyID = new Map<string, number>()
  const headerNameByColumnIndex = new Map<number, string>()
  const headerNameByKeyID = new Map<string, string>()
  const headers: DomAttributeViewHeader[] = []
  let nextColumnIndex = 0

  for (const [fallbackColumnIndex, cell] of resolveDomAttributeViewHeaderCells(blockElement).entries()) {
    const keyID = resolveDomAttributeViewKeyId(cell, fallbackColumnIndex)
    const stableKeyID = getStableDomAttributeViewKeyID(keyID)
    const text = getAttributeViewDomText(cell)
    if (stableKeyID && keyedColumnIndexByKeyID.has(stableKeyID)) {
      continue
    }
    if (!stableKeyID && !text) {
      continue
    }

    const columnIndex = stableKeyID
      ? nextColumnIndex
      : fallbackColumnIndex

    if (stableKeyID) {
      keyedColumnIndexByKeyID.set(stableKeyID, columnIndex)
      headerNameByKeyID.set(stableKeyID, text)
      nextColumnIndex = columnIndex + 1
    } else {
      nextColumnIndex = Math.max(nextColumnIndex, columnIndex + 1)
    }

    headerNameByColumnIndex.set(columnIndex, text)
    headers.push({
      cell,
      columnIndex,
      emitCandidate: Boolean(text),
      keyID,
      text,
    })
  }

  return {
    headers,
    headerNameByColumnIndex,
    headerNameByKeyID,
    keyedColumnIndexByKeyID,
  }
}

// 行归一化（RF-109 拆分）：主循环按行分组；单元格→候选的收集与"发现列"的
// 分配逻辑分别抽为 collectRowGroupCandidates 与 createDomColumnAllocator。
function normalizeDomAttributeViewRowGroups({
  blockElement,
  headerInfo,
}: {
  blockElement: HTMLElement
  headerInfo: DomAttributeViewHeaderInfo
}) {
  const allocator = createDomColumnAllocator(headerInfo)
  const groups: Array<DomAttributeViewNormalizedRowGroup & {
    dedupeKeys: Set<string>
    order: number
  }> = []
  const groupsByRowID = new Map<string, DomAttributeViewNormalizedRowGroup & {
    dedupeKeys: Set<string>
    order: number
  }>()

  for (const [rowIndex, rowElement] of resolveDomAttributeViewRows(blockElement).entries()) {
    const stableRowID = resolveDomAttributeViewRowId(rowElement)
    const rowGroup = stableRowID
      ? groupsByRowID.get(stableRowID) ?? createDomAttributeViewRowGroup(rowElement, stableRowID, rowIndex)
      : createDomAttributeViewRowGroup(rowElement, undefined, rowIndex)

    if (stableRowID && !groupsByRowID.has(stableRowID)) {
      groupsByRowID.set(stableRowID, rowGroup)
      groups.push(rowGroup)
    }
    if (!stableRowID) {
      groups.push(rowGroup)
    }

    collectRowGroupCandidates(rowGroup, getDomAttributeViewRowCells(rowElement), headerInfo, allocator)
  }

  return groups.map(({
    candidates,
    dedupeKeys: _,
    order: __,
    ...group
  }) => ({
    ...group,
    candidates: candidates
      .map((candidate, index) => ({
        ...candidate,
        order: index,
      }))
      .sort((left, right) => left.columnIndex - right.columnIndex || left.order - right.order)
      .map(({
        order,
        ...candidate
      }) => candidate),
  }))
}

interface DomColumnAllocator {
  getOrCreateDiscoveredColumnIndex: (keyID: string, fallbackIndex: number) => number
}

// "发现列"分配器：为表头未声明、行内新出现的 stable keyID 分配不冲突的列序。
// 原实现为 normalizeDomAttributeViewRowGroups 内的闭包 + 三套索引状态（RF-109 收敛）。
function createDomColumnAllocator(headerInfo: DomAttributeViewHeaderInfo): DomColumnAllocator {
  const discoveredColumnIndexByKeyID = new Map<string, number>()
  const reservedHeaderColumnIndices = headerInfo.keyedColumnIndexByKeyID.size > 0
    ? new Set(headerInfo.headers.map((header) => header.columnIndex))
    : new Set<number>()
  let nextDiscoveredColumnIndex = Math.max(
    0,
    ...Array.from(reservedHeaderColumnIndices, (columnIndex) => columnIndex + 1),
  )

  function getOrCreateDiscoveredColumnIndex(keyID: string, fallbackIndex: number) {
    const existing = discoveredColumnIndexByKeyID.get(keyID)
    if (existing !== undefined) {
      return existing
    }

    const discoveredIndex = !reservedHeaderColumnIndices.has(fallbackIndex)
      && !Array.from(discoveredColumnIndexByKeyID.values()).includes(fallbackIndex)
      ? fallbackIndex
      : Math.max(nextDiscoveredColumnIndex, fallbackIndex)
    discoveredColumnIndexByKeyID.set(keyID, discoveredIndex)
    nextDiscoveredColumnIndex = Math.max(nextDiscoveredColumnIndex, discoveredIndex + 1)
    return discoveredIndex
  }

  return {
    getOrCreateDiscoveredColumnIndex,
  }
}

function collectRowGroupCandidates(
  rowGroup: DomAttributeViewNormalizedRowGroup & {
    dedupeKeys: Set<string>
    order: number
  },
  rowCells: HTMLElement[],
  headerInfo: DomAttributeViewHeaderInfo,
  allocator: DomColumnAllocator,
) {
  for (const [cellIndex, cell] of rowCells.entries()) {
    const text = getAttributeViewDomText(cell)
    if (!text) {
      continue
    }

    rowGroup.rowLabel ||= text

    const resolvedKeyID = resolveDomAttributeViewKeyId(cell, cellIndex)
    const stableKeyID = getStableDomAttributeViewKeyID(resolvedKeyID)
    const columnIndex = stableKeyID && headerInfo.keyedColumnIndexByKeyID.has(stableKeyID)
      ? headerInfo.keyedColumnIndexByKeyID.get(stableKeyID)!
      : stableKeyID
        ? allocator.getOrCreateDiscoveredColumnIndex(stableKeyID, cellIndex)
        : cellIndex
    const columnName = stableKeyID
      ? headerInfo.headerNameByKeyID.get(stableKeyID) ?? headerInfo.headerNameByColumnIndex.get(columnIndex) ?? ''
      : headerInfo.headerNameByColumnIndex.get(columnIndex) ?? ''
    const logicalColumnKey = stableKeyID ?? `index:${columnIndex}`
    const dedupeKey = `${logicalColumnKey}::${text}`
    if (rowGroup.dedupeKeys.has(dedupeKey)) {
      continue
    }

    // 注（RF-109）：原实现此处还有一段"登记发现列"的赋值，但其前置条件
    // （stableKeyID 不在表头映射且不在发现映射中）在上面的
    // getOrCreateDiscoveredColumnIndex 调用后恒为假（发现映射必然已登记），
    // 属不可达死代码，特征测试钉住行为后移除。

    rowGroup.dedupeKeys.add(dedupeKey)
    rowGroup.candidates.push({
      columnIndex,
      columnName,
      keyID: resolvedKeyID,
      text,
    })
  }
}

function createDomAttributeViewRowGroup(
  sourceElement: HTMLElement,
  rowID: string | undefined,
  order: number,
) {
  return {
    candidates: [],
    dedupeKeys: new Set<string>(),
    order,
    rowID,
    rowLabel: undefined,
    sourceElement,
  }
}

function resolveDomAttributeViewRows(blockElement: HTMLElement) {
  const explicitRows = Array.from(blockElement.querySelectorAll<HTMLElement>([
    '.av__row[data-id]',
    '.av__gallery-item[data-id]',
    '.av__card[data-id]',
    '.av__kanban-item[data-id]',
    '[data-item-id]',
    '[data-row-id]',
  ].join(', ')))
    .filter((rowElement) => !rowElement.classList.contains('av__row--header'))
    .filter(isVisibleAttributeViewElement)
  if (explicitRows.length > 0) {
    return getTopLevelElements(explicitRows)
  }

  const fallbackRows = Array.from(blockElement.querySelectorAll<HTMLElement>('[data-id]'))
    .filter((rowElement) => rowElement !== blockElement)
    .filter((rowElement) => !rowElement.classList.contains('av__row--header'))
    .filter(isVisibleAttributeViewElement)
    .filter((rowElement) => rowElement.querySelector('.av__cell, [data-av-key-id], [data-key-id], .av__celltext'))

  return getTopLevelElements(fallbackRows)
}

function resolveDomAttributeViewHeaderCells(blockElement: HTMLElement) {
  const headerCells = Array.from(blockElement.querySelectorAll<HTMLElement>('.av__row--header .av__cell.av__cell--header'))
    .filter(isVisibleAttributeViewElement)
  if (headerCells.length) {
    return headerCells
  }

  return Array.from(blockElement.querySelectorAll<HTMLElement>('.av__cell.av__cell--header'))
    .filter(isVisibleAttributeViewElement)
}

function getDomAttributeViewRowCells(rowElement: HTMLElement) {
  const body = rowElement.querySelector<HTMLElement>(':scope > .av__body')
    ?? rowElement.querySelector<HTMLElement>('.av__body')
    ?? rowElement

  const directCells = Array.from(body.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement)
    .filter((child) => child.classList.contains('av__cell'))
    .filter((child) => !child.classList.contains('av__cell--header'))
    .filter(isVisibleAttributeViewElement)
  if (directCells.length > 0) {
    return directCells
  }

  const descendantCells = Array.from(body.querySelectorAll<HTMLElement>('.av__cell'))
    .filter((child) => !child.classList.contains('av__cell--header'))
    .filter(isVisibleAttributeViewElement)
  if (descendantCells.length > 0) {
    return getTopLevelElements(descendantCells)
  }

  const keyedCells = Array.from(body.querySelectorAll<HTMLElement>('[data-av-key-id], [data-key-id]'))
    .filter((child) => !child.classList.contains('av__cell--header'))
    .filter(isVisibleAttributeViewElement)
  if (keyedCells.length > 0) {
    return getTopLevelElements(keyedCells)
  }

  return []
}

function resolveDomAttributeViewKeyId(cellElement: HTMLElement, columnIndex: number) {
  return cellElement.dataset.avKeyId?.trim()
    || cellElement.dataset.keyId?.trim()
    || cellElement.dataset.fieldId?.trim()
    || cellElement.dataset.colId?.trim()
    || cellElement.dataset.columnId?.trim()
    || cellElement.querySelector<HTMLElement>('[data-av-key-id]')?.dataset.avKeyId?.trim()
    || cellElement.querySelector<HTMLElement>('[data-key-id]')?.dataset.keyId?.trim()
    || cellElement.querySelector<HTMLElement>('[data-field-id]')?.dataset.fieldId?.trim()
    || cellElement.querySelector<HTMLElement>('[data-col-id]')?.dataset.colId?.trim()
    || cellElement.querySelector<HTMLElement>('[data-column-id]')?.dataset.columnId?.trim()
    || `__dom-col-${columnIndex}__`
}

function getStableDomAttributeViewKeyID(keyID: string) {
  return keyID.startsWith('__dom-col-') ? undefined : keyID
}

function getAttributeViewDomText(element: HTMLElement) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!(node instanceof Text) || !node.nodeValue?.trim()) {
        return NodeFilter.FILTER_REJECT
      }

      const parentElement = node.parentElement
      if (
        !parentElement
        || parentElement.closest('.protyle-attr, svg, style, script, .av__gallery-tip, .av__widthdrag, .b3-chip[data-type="block-more"]')
        || !isVisibleAttributeViewElement(parentElement)
      ) {
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

  return textParts.join('').replace(/\s+/g, ' ').trim()
}

function resolveDomAttributeViewRowId(rowElement: HTMLElement) {
  return rowElement.dataset.id?.trim()
    || rowElement.dataset.itemId?.trim()
    || rowElement.dataset.rowId?.trim()
    || undefined
}

// 以祖先链遍历实现 O(n·d) 顶层过滤（RF-109）：原实现为两两比较的 O(n²)
// （findIndex 去重 + some(contains)），长文档行数多时是隐藏热点。
// 行为等价：某元素被其他元素包含 ⇔ 其祖先链上存在另一个被选元素。
function getTopLevelElements(elements: HTMLElement[]) {
  const unique = Array.from(new Set(elements))
  const selected = new Set(unique)
  return unique.filter((element) => {
    let current = element.parentElement
    while (current) {
      if (selected.has(current)) {
        return false
      }

      current = current.parentElement
    }

    return true
  })
}

function isVisibleAttributeViewElement(element: HTMLElement) {
  let current: HTMLElement | null = element
  while (current) {
    if (
      current.classList.contains('fn__none')
      || current.hasAttribute('hidden')
      || current.getAttribute('aria-hidden') === 'true'
      || current.closest('.protyle-attr')
    ) {
      return false
    }

    const style = globalThis.getComputedStyle?.(current)
    if (style && (style.display === 'none' || style.visibility === 'hidden')) {
      return false
    }

    current = current.parentElement
  }

  return true
}

function createOrderedCandidate(sourceElement: HTMLElement, candidate: AttributeViewCellCandidate) {
  return {
    candidate,
    sourceElement,
  }
}

function compareDomCandidateOrder(left: HTMLElement, right: HTMLElement) {
  if (left === right) {
    return 0
  }

  const position = left.compareDocumentPosition(right)
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
    return -1
  }
  if (position & Node.DOCUMENT_POSITION_PRECEDING) {
    return 1
  }

  return 0
}
