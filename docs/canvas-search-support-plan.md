# Canvas Search Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `siyuan-sou-easy` search the active `siyuan-canvas` tab, highlight hits, and replace hits in Canvas text nodes while keeping note/file-node hits view-only.

**Architecture:** `siyuan-canvas` exposes a stable runtime search bridge for active Canvas tabs. `siyuan-sou-easy` detects that bridge as an alternate search surface, maps Canvas targets into the existing match engine, and dispatches Canvas highlighting, reveal, and replacement through the bridge instead of Protyle block DOM APIs.

**Tech Stack:** TypeScript, Vue 3, Vitest, SiYuan plugin APIs, JSON Canvas document model.

---

## File Structure

### `D:\MyCodingProjects\siyuan-canvas`

- Create: `src/canvas/search-bridge.ts`  
  Defines the Canvas search bridge contract, target collection, range replacement, registry helpers, and decoration state helpers.

- Modify: `src/canvas/use-canvas-editor.ts`  
  Creates and registers a search host for each mounted Canvas editor, exposes snapshot/reveal/replace/decoration behavior, and unregisters on unmount.

- Modify: `src/components/canvas/CanvasWorkspace.vue`  
  Adds stable `data-canvas-*` attributes and CSS classes for match/current highlighting on rendered Canvas nodes.

- Test: `tests/canvas-search-bridge.test.ts`  
  Covers target collection, text-node replacement, note/file target read-only policy, and registry selection.

### `D:\MyCodingProjects\siyuan-sou-easy`

- Create: `src/features/search-replace/canvas/types.ts`  
  Local copy of the bridge contract needed by the search plugin without importing from another plugin package.

- Create: `src/features/search-replace/canvas/context.ts`  
  Discovers the active Canvas search host and builds an editor-like context.

- Create: `src/features/search-replace/canvas/search-blocks.ts`  
  Converts Canvas search targets into `SearchableBlock` records with Canvas metadata.

- Create: `src/features/search-replace/canvas/decorations.ts`  
  Converts `SearchMatch[]` into Canvas bridge decorations and delegates reveal/visibility.

- Create: `src/features/search-replace/canvas/replacement.ts`  
  Groups replaceable Canvas text matches and calls `host.replaceTextRanges`.

- Modify: `src/features/search-replace/types.ts`  
  Adds Canvas metadata to `SearchableBlock`/`SearchMatch`, and allows explicit replaceability.

- Modify: `src/features/search-replace/search-engine.ts`  
  Preserves Canvas metadata and honors explicit `block.replaceable` without DOM range checks.

- Modify: `src/features/search-replace/editor/context.ts` and `src/features/search-replace/store/search-controller.ts`  
  Uses Canvas context when active and dispatches search/decoration/navigation appropriately.

- Modify: `src/features/search-replace/store/replacement.ts` and `src/features/search-replace/match-utils.ts`  
  Routes Canvas text replacements through the bridge, and rejects Canvas note/file replacements with a clear message.

- Test: `tests/canvas-search-blocks.test.ts`, `tests/canvas-search-engine.test.ts`, `tests/canvas-replacement.test.ts`  
  Covers mapping, match metadata, replacement grouping, and read-only note/file behavior.

---

## Task 1: Canvas Bridge Pure Contract and Target Collection

**Files:**
- Create: `D:\MyCodingProjects\siyuan-canvas\src\canvas\search-bridge.ts`
- Test: `D:\MyCodingProjects\siyuan-canvas\tests\canvas-search-bridge.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests that build a Canvas document with text, file, group, and edge labels:

```ts
import { describe, expect, it } from "vitest"
import {
  collectCanvasSearchTargets,
  replaceCanvasTextTargetRanges,
} from "@/canvas/search-bridge"

describe("canvas search bridge", () => {
  it("collects text nodes as replaceable and file nodes as view-only note targets", () => {
    const targets = collectCanvasSearchTargets({
      document: {
        nodes: [
          { id: "t1", type: "text", text: "Alpha note", x: 0, y: 0, width: 320, height: 180 },
          { id: "f1", type: "file", file: "20260101010101-abcdefg", x: 0, y: 240, width: 320, height: 180 },
          { id: "g1", type: "group", label: "Group Alpha", x: 0, y: 480, width: 640, height: 360 },
        ],
        edges: [
          { id: "e1", fromNode: "t1", fromSide: "right", toNode: "f1", toSide: "left", label: "Edge Alpha" },
        ],
      },
      fileNodeTextById: new Map([["f1", "Document Alpha\n/data/doc.sy"]]),
    })

    expect(targets.map(target => ({
      field: target.field,
      nodeId: target.nodeId,
      replaceable: target.replaceable,
      text: target.text,
      type: target.type,
    }))).toEqual([
      { field: "text", nodeId: "t1", replaceable: true, text: "Alpha note", type: "node" },
      { field: "note", nodeId: "f1", replaceable: false, text: "Document Alpha\n/data/doc.sy", type: "node" },
      { field: "label", nodeId: "g1", replaceable: false, text: "Group Alpha", type: "node" },
      { field: "label", nodeId: "e1", replaceable: false, text: "Edge Alpha", type: "edge" },
    ])
  })

  it("replaces text node ranges in reverse order and leaves other targets untouched", () => {
    const result = replaceCanvasTextTargetRanges({
      document: {
        nodes: [
          { id: "t1", type: "text", text: "Alpha Alpha", x: 0, y: 0, width: 320, height: 180 },
          { id: "f1", type: "file", file: "Alpha", x: 0, y: 240, width: 320, height: 180 },
        ],
        edges: [],
      },
      ranges: [
        { start: 0, end: 5, text: "Beta" },
        { start: 6, end: 11, text: "Gamma" },
      ],
      targetId: "node:t1:text",
    })

    expect(result.appliedCount).toBe(2)
    expect(result.document.nodes[0]).toMatchObject({ text: "Beta Gamma" })
    expect(result.document.nodes[1]).toMatchObject({ file: "Alpha" })
  })
})
```

- [ ] **Step 2: Verify red**

Run: `pnpm test tests/canvas-search-bridge.test.ts` in `D:\MyCodingProjects\siyuan-canvas`  
Expected: FAIL because `@/canvas/search-bridge` does not exist.

- [ ] **Step 3: Implement bridge pure functions**

Create `src/canvas/search-bridge.ts` with:

```ts
import type { CanvasDocument, CanvasNode } from "@/canvas/types"

export type CanvasSearchTargetField = "label" | "note" | "text"
export type CanvasSearchTargetType = "edge" | "node"

export interface CanvasSearchTarget {
  field: CanvasSearchTargetField
  id: string
  nodeId: string
  replaceable: boolean
  text: string
  title: string
  type: CanvasSearchTargetType
}

export interface CanvasSearchDecoration {
  current: boolean
  end: number
  start: number
  targetId: string
}

export interface CanvasSearchHostSnapshot {
  revision: string
  targets: CanvasSearchTarget[]
}

export interface CanvasSearchHostContext {
  filePath: string
  id: string
  readonly: boolean
  title: string
}

export interface CanvasSearchHost {
  getContext: () => CanvasSearchHostContext
  getSnapshot: () => Promise<CanvasSearchHostSnapshot>
  replaceTextRanges: (
    targetId: string,
    ranges: Array<{ end: number, start: number, text: string }>,
  ) => Promise<{ appliedCount: number, revision: string }>
  reveal: (targetId: string, range?: { end: number, start: number }) => Promise<boolean>
  subscribe: (listener: () => void) => () => void
  syncDecorations: (decorations: CanvasSearchDecoration[]) => void
  version: 1
}

export interface CollectCanvasSearchTargetsOptions {
  document: CanvasDocument
  fileNodeTextById?: Map<string, string>
}

export function getCanvasSearchRegistry(): Set<CanvasSearchHost> {
  const globalWithRegistry = window as Window & { __siyuanCanvasSearchHosts?: Set<CanvasSearchHost> }
  if (!globalWithRegistry.__siyuanCanvasSearchHosts) {
    globalWithRegistry.__siyuanCanvasSearchHosts = new Set()
  }
  return globalWithRegistry.__siyuanCanvasSearchHosts
}

export function registerCanvasSearchHost(host: CanvasSearchHost): () => void {
  const registry = getCanvasSearchRegistry()
  registry.add(host)
  return () => {
    registry.delete(host)
  }
}

export function collectCanvasSearchTargets(options: CollectCanvasSearchTargetsOptions): CanvasSearchTarget[] {
  const fileNodeTextById = options.fileNodeTextById ?? new Map()
  const targets: CanvasSearchTarget[] = []

  for (const node of options.document.nodes) {
    const target = createNodeSearchTarget(node, fileNodeTextById)
    if (target) {
      targets.push(target)
    }
  }

  for (const edge of options.document.edges) {
    const label = edge.label?.trim()
    if (!label) {
      continue
    }

    targets.push({
      field: "label",
      id: `edge:${edge.id}:label`,
      nodeId: edge.id,
      replaceable: false,
      text: label,
      title: label,
      type: "edge",
    })
  }

  return targets
}

function createNodeSearchTarget(node: CanvasNode, fileNodeTextById: Map<string, string>): CanvasSearchTarget | null {
  if (node.type === "text" && node.text.length > 0) {
    return {
      field: "text",
      id: `node:${node.id}:text`,
      nodeId: node.id,
      replaceable: true,
      text: node.text,
      title: firstLine(node.text) || node.id,
      type: "node",
    }
  }

  if (node.type === "file") {
    const text = fileNodeTextById.get(node.id)?.trim() || node.file.trim()
    if (!text) {
      return null
    }

    return {
      field: "note",
      id: `node:${node.id}:note`,
      nodeId: node.id,
      replaceable: false,
      text,
      title: firstLine(text) || node.file,
      type: "node",
    }
  }

  if (node.type === "group") {
    const label = node.label?.trim()
    if (!label) {
      return null
    }

    return {
      field: "label",
      id: `node:${node.id}:label`,
      nodeId: node.id,
      replaceable: false,
      text: label,
      title: label,
      type: "node",
    }
  }

  return null
}

export function replaceCanvasTextTargetRanges(options: {
  document: CanvasDocument
  ranges: Array<{ end: number, start: number, text: string }>
  targetId: string
}): { appliedCount: number, document: CanvasDocument } {
  const parsed = parseCanvasTargetId(options.targetId)
  if (!parsed || parsed.type !== "node" || parsed.field !== "text") {
    return { appliedCount: 0, document: options.document }
  }

  let appliedCount = 0
  const ranges = [...options.ranges].sort((left, right) => right.start - left.start)
  const nodes = options.document.nodes.map((node) => {
    if (node.id !== parsed.id || node.type !== "text") {
      return node
    }

    let text = node.text
    for (const range of ranges) {
      if (!isValidReplacementRange(text, range.start, range.end)) {
        continue
      }
      text = `${text.slice(0, range.start)}${range.text}${text.slice(range.end)}`
      appliedCount += 1
    }

    return appliedCount > 0 ? { ...node, text } : node
  })

  return {
    appliedCount,
    document: appliedCount > 0 ? { ...options.document, nodes } : options.document,
  }
}

export function parseCanvasTargetId(targetId: string): { field: CanvasSearchTargetField, id: string, type: CanvasSearchTargetType } | null {
  const [type, id, field] = targetId.split(":")
  if ((type !== "node" && type !== "edge") || !id || !isCanvasSearchTargetField(field)) {
    return null
  }

  return { field, id, type }
}

function isCanvasSearchTargetField(value: string | undefined): value is CanvasSearchTargetField {
  return value === "label" || value === "note" || value === "text"
}

function isValidReplacementRange(text: string, start: number, end: number) {
  return Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end >= start && end <= text.length
}

function firstLine(text: string) {
  return text.split(/\r?\n/, 1)[0]?.trim() ?? ""
}
```

- [ ] **Step 4: Verify green**

Run: `pnpm test tests/canvas-search-bridge.test.ts`  
Expected: PASS.

---

## Task 2: Canvas Runtime Host Registration and DOM Markers

**Files:**
- Modify: `D:\MyCodingProjects\siyuan-canvas\src\canvas\use-canvas-editor.ts`
- Modify: `D:\MyCodingProjects\siyuan-canvas\src\components\canvas\CanvasWorkspace.vue`
- Test: `D:\MyCodingProjects\siyuan-canvas\tests\canvas-search-bridge.test.ts`

- [ ] **Step 1: Add failing registry/revision test**

Extend the bridge test:

```ts
import {
  createCanvasSearchRevision,
  getCanvasSearchRegistry,
  registerCanvasSearchHost,
} from "@/canvas/search-bridge"

it("registers hosts globally and creates stable snapshot revisions", () => {
  const host = {
    version: 1 as const,
    getContext: () => ({ filePath: "/data/canvas/a.canvas", id: "canvas:/data/canvas/a.canvas", readonly: false, title: "a.canvas" }),
    getSnapshot: async () => ({ revision: "r1", targets: [] }),
    replaceTextRanges: async () => ({ appliedCount: 0, revision: "r1" }),
    reveal: async () => false,
    subscribe: () => () => undefined,
    syncDecorations: () => undefined,
  }

  const unregister = registerCanvasSearchHost(host)
  expect(getCanvasSearchRegistry().has(host)).toBe(true)
  unregister()
  expect(getCanvasSearchRegistry().has(host)).toBe(false)

  expect(createCanvasSearchRevision("/data/canvas/a.canvas", 3, "raw")).toBe("canvas:/data/canvas/a.canvas:3:3")
})
```

- [ ] **Step 2: Verify red**

Run: `pnpm test tests/canvas-search-bridge.test.ts`  
Expected: FAIL because `createCanvasSearchRevision` is missing.

- [ ] **Step 3: Implement runtime bridge registration**

Add `createCanvasSearchRevision` to `search-bridge.ts`:

```ts
export function createCanvasSearchRevision(filePath: string, nodeCount: number, raw: string) {
  return `canvas:${filePath}:${nodeCount}:${raw.length}`
}
```

In `use-canvas-editor.ts`, import bridge helpers:

```ts
import {
  collectCanvasSearchTargets,
  createCanvasSearchRevision,
  registerCanvasSearchHost,
  replaceCanvasTextTargetRanges,
  type CanvasSearchDecoration,
} from "@/canvas/search-bridge"
```

Create `searchDecorations = ref<CanvasSearchDecoration[]>([])`, `searchListeners = new Set<() => void>()`, helper `notifyCanvasSearchChanged()`, helper `getFileNodeSearchTextById()`, and register a host in `onMounted`; unregister in `onBeforeUnmount`.

The host uses:
- `getContext()` from `state.filePath`, `suggestedFilename`, and conflict state.
- `getSnapshot()` from `state.document` and `getResolvedFileNode()` details for file nodes.
- `replaceTextRanges()` via `replaceCanvasTextTargetRanges()` then `commitDocument()`.
- `reveal()` parses target id, calls `state.selectNode(nodeId)`, then `centerSelectionInViewport()`.
- `syncDecorations()` writes `searchDecorations.value`.

Return `searchDecorations` in `createCanvasEditorBindings`.

- [ ] **Step 4: Add DOM markers and classes**

In `CanvasWorkspace.vue`:

```vue
<article
  :data-canvas-node-id="node.id"
  :data-canvas-node-type="node.type"
  :class="[
    `canvas-node--${node.type}`,
    {
      'canvas-node--search-match': hasCanvasSearchMatch(node.id),
      'canvas-node--search-current': hasCanvasCurrentSearchMatch(node.id),
      'canvas-node--selected': editor.state.selectedNodeIds.includes(node.id),
    },
  ]"
>
```

Add field markers to text/file/group rendered containers:

```vue
data-canvas-field="text"
data-canvas-field="note"
data-canvas-field="label"
```

Add helpers:

```ts
function hasCanvasSearchMatch(nodeId: string) {
  return editor.searchDecorations.some(decoration => decoration.targetId.startsWith(`node:${nodeId}:`))
}

function hasCanvasCurrentSearchMatch(nodeId: string) {
  return editor.searchDecorations.some(decoration => decoration.current && decoration.targetId.startsWith(`node:${nodeId}:`))
}
```

Add CSS:

```scss
.canvas-node--search-match {
  box-shadow: 0 0 0 2px var(--b3-theme-primary-light), var(--canvas-shadow);
}

.canvas-node--search-current {
  box-shadow: 0 0 0 3px var(--b3-theme-primary), var(--canvas-shadow-strong);
}
```

- [ ] **Step 5: Verify**

Run: `pnpm test tests/canvas-search-bridge.test.ts`  
Run: `pnpm test tests/canvas-workspace.test.ts`  
Expected: PASS.

---

## Task 3: Search Plugin Canvas Types, Context, and Block Mapping

**Files:**
- Create: `D:\MyCodingProjects\siyuan-sou-easy\src\features\search-replace\canvas\types.ts`
- Create: `D:\MyCodingProjects\siyuan-sou-easy\src\features\search-replace\canvas\context.ts`
- Create: `D:\MyCodingProjects\siyuan-sou-easy\src\features\search-replace\canvas\search-blocks.ts`
- Modify: `D:\MyCodingProjects\siyuan-sou-easy\src\features\search-replace\types.ts`
- Test: `D:\MyCodingProjects\siyuan-sou-easy\tests\canvas-search-blocks.test.ts`

- [ ] **Step 1: Write failing block mapping test**

Create `tests/canvas-search-blocks.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mapCanvasTargetsToSearchableBlocks } from '@/features/search-replace/canvas/search-blocks'

describe('canvas search block mapping', () => {
  it('maps canvas targets to searchable blocks with explicit replaceability', () => {
    const blocks = mapCanvasTargetsToSearchableBlocks({
      context: {
        rootId: 'canvas:/data/storage/canvas/a.canvas',
        title: 'a.canvas',
        protyle: document.createElement('div'),
        sourceKind: 'canvas',
        canvas: {
          filePath: '/data/storage/canvas/a.canvas',
          host: {} as any,
        },
      } as any,
      targets: [
        { id: 'node:t1:text', nodeId: 't1', type: 'node', field: 'text', text: 'Alpha', title: 'Alpha', replaceable: true },
        { id: 'node:f1:note', nodeId: 'f1', type: 'node', field: 'note', text: 'Alpha doc', title: 'Doc', replaceable: false },
      ],
    })

    expect(blocks.map(block => ({
      blockId: block.blockId,
      blockType: block.blockType,
      replaceable: block.replaceable,
      text: block.text,
      targetId: block.canvas?.targetId,
    }))).toEqual([
      { blockId: 'canvas:node:t1:text', blockType: 'CanvasTextNode', replaceable: true, text: 'Alpha', targetId: 'node:t1:text' },
      { blockId: 'canvas:node:f1:note', blockType: 'CanvasNoteNode', replaceable: false, text: 'Alpha doc', targetId: 'node:f1:note' },
    ])
  })
})
```

- [ ] **Step 2: Verify red**

Run: `pnpm test tests/canvas-search-blocks.test.ts`  
Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement mapping and types**

Extend `EditorContext`, `SearchableBlock`, `SearchMatch`, and `SearchableBlockSummary` with optional Canvas metadata:

```ts
sourceKind?: 'protyle' | 'canvas'
canvas?: {
  filePath?: string
  field?: 'label' | 'note' | 'text'
  host?: CanvasSearchHost
  nodeId?: string
  targetId: string
  targetType?: 'edge' | 'node'
}
replaceable?: boolean
```

Create local bridge contract in `canvas/types.ts`, context host discovery in `canvas/context.ts`, and target mapping in `canvas/search-blocks.ts`.

- [ ] **Step 4: Verify green**

Run: `pnpm test tests/canvas-search-blocks.test.ts`  
Expected: PASS.

---

## Task 4: Match Engine Preserves Canvas Metadata

**Files:**
- Modify: `D:\MyCodingProjects\siyuan-sou-easy\src\features\search-replace\search-engine.ts`
- Test: `D:\MyCodingProjects\siyuan-sou-easy\tests\search-engine.test.ts`

- [ ] **Step 1: Add failing test**

Add to `tests/search-engine.test.ts`:

```ts
it('preserves canvas metadata and explicit replaceability', () => {
  const result = findMatches([
    {
      ...createBlock('Alpha Alpha', 0),
      blockId: 'canvas:node:t1:text',
      blockType: 'CanvasTextNode',
      canvas: {
        field: 'text',
        nodeId: 't1',
        targetId: 'node:t1:text',
        targetType: 'node',
      },
      replaceable: true,
      sourceKind: 'canvas',
    } as SearchableBlock,
    {
      ...createBlock('Alpha doc', 1),
      blockId: 'canvas:node:f1:note',
      blockType: 'CanvasNoteNode',
      canvas: {
        field: 'note',
        nodeId: 'f1',
        targetId: 'node:f1:note',
        targetType: 'node',
      },
      replaceable: false,
      sourceKind: 'canvas',
    } as SearchableBlock,
  ], 'Alpha', defaultOptions)

  expect(result.matches.map(match => ({
    canvas: match.canvas,
    replaceable: match.replaceable,
    sourceKind: match.sourceKind,
  }))).toEqual([
    {
      canvas: { field: 'text', nodeId: 't1', targetId: 'node:t1:text', targetType: 'node' },
      replaceable: true,
      sourceKind: 'canvas',
    },
    {
      canvas: { field: 'text', nodeId: 't1', targetId: 'node:t1:text', targetType: 'node' },
      replaceable: true,
      sourceKind: 'canvas',
    },
    {
      canvas: { field: 'note', nodeId: 'f1', targetId: 'node:f1:note', targetType: 'node' },
      replaceable: false,
      sourceKind: 'canvas',
    },
  ])
})
```

- [ ] **Step 2: Verify red**

Run: `pnpm test tests/search-engine.test.ts`  
Expected: FAIL because metadata is not copied.

- [ ] **Step 3: Implement metadata propagation**

In `findMatches`, set:

```ts
replaceable: typeof block.replaceable === 'boolean'
  ? block.replaceable
  : isRangeReplaceable(block.element, start, end),
sourceKind: block.sourceKind === 'canvas' ? 'canvas' : block.sourceKind,
canvas: block.canvas,
```

- [ ] **Step 4: Verify green**

Run: `pnpm test tests/search-engine.test.ts`  
Expected: PASS.

---

## Task 5: Search Controller Dispatches Canvas Context

**Files:**
- Modify: `D:\MyCodingProjects\siyuan-sou-easy\src\features\search-replace\store\search-blocks.ts`
- Modify: `D:\MyCodingProjects\siyuan-sou-easy\src\features\search-replace\store\search-controller.ts`
- Modify: `D:\MyCodingProjects\siyuan-sou-easy\src\features\search-replace\store.ts`
- Test: `D:\MyCodingProjects\siyuan-sou-easy\tests\canvas-search-blocks.test.ts`

- [ ] **Step 1: Add failing async host test**

Add to `canvas-search-blocks.test.ts`:

```ts
import { resolveCanvasBlocksForSearch } from '@/features/search-replace/canvas/search-blocks'

it('resolves canvas blocks from the host snapshot', async () => {
  const host = {
    getSnapshot: async () => ({
      revision: 'r1',
      targets: [
        { id: 'node:t1:text', nodeId: 't1', type: 'node', field: 'text', text: 'Alpha', title: 'Alpha', replaceable: true },
      ],
    }),
  }
  const result = await resolveCanvasBlocksForSearch({
    rootId: 'canvas:/data/a.canvas',
    title: 'a.canvas',
    protyle: document.createElement('div'),
    sourceKind: 'canvas',
    canvas: { filePath: '/data/a.canvas', host },
  } as any)

  expect(result.documentContent).toBe('')
  expect(result.blocks).toHaveLength(1)
  expect(result.blocks[0]?.canvas?.host).toBe(host)
})
```

- [ ] **Step 2: Verify red**

Run: `pnpm test tests/canvas-search-blocks.test.ts`  
Expected: FAIL because `resolveCanvasBlocksForSearch` is missing.

- [ ] **Step 3: Implement Canvas branch**

In `store/search-blocks.ts`, if `context.sourceKind === 'canvas'`, call `resolveCanvasBlocksForSearch(context)` and skip document snapshots.

In `store.ts` and context resolution, prefer active Canvas context before Protyle context when a visible Canvas host exists in the active layout window.

- [ ] **Step 4: Verify**

Run: `pnpm test tests/canvas-search-blocks.test.ts`  
Run: `pnpm test tests/store-context.test.ts`  
Expected: PASS.

---

## Task 6: Canvas Decorations, Reveal, and Visibility

**Files:**
- Create: `D:\MyCodingProjects\siyuan-sou-easy\src\features\search-replace\canvas\decorations.ts`
- Modify: `D:\MyCodingProjects\siyuan-sou-easy\src\features\search-replace\editor\decorations.ts`
- Test: `D:\MyCodingProjects\siyuan-sou-easy\tests\canvas-search-decoration.test.ts`

- [ ] **Step 1: Write failing decoration test**

Create `tests/canvas-search-decoration.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { syncCanvasSearchDecorations } from '@/features/search-replace/canvas/decorations'

describe('canvas search decorations', () => {
  it('passes canvas match ranges to the host and marks current match', () => {
    const syncDecorations = vi.fn()
    const host = { syncDecorations }
    syncCanvasSearchDecorations({
      context: { sourceKind: 'canvas', canvas: { host } } as any,
      currentMatch: { id: 'm2' } as any,
      matches: [
        { id: 'm1', start: 0, end: 5, canvas: { targetId: 'node:t1:text' }, sourceKind: 'canvas' },
        { id: 'm2', start: 6, end: 11, canvas: { targetId: 'node:t1:text' }, sourceKind: 'canvas' },
      ] as any,
    })

    expect(syncDecorations).toHaveBeenCalledWith([
      { current: false, start: 0, end: 5, targetId: 'node:t1:text' },
      { current: true, start: 6, end: 11, targetId: 'node:t1:text' },
    ])
  })
})
```

- [ ] **Step 2: Verify red**

Run: `pnpm test tests/canvas-search-decoration.test.ts`  
Expected: FAIL because module is missing.

- [ ] **Step 3: Implement Canvas decoration delegation**

Create `canvas/decorations.ts` with `syncCanvasSearchDecorations`, `scrollCanvasMatchIntoView`, and `isCanvasMatchVisible`. In editor decoration exports, branch early when `context.sourceKind === 'canvas'`.

- [ ] **Step 4: Verify green**

Run: `pnpm test tests/canvas-search-decoration.test.ts`  
Expected: PASS.

---

## Task 7: Canvas Text Replacement and Note Read-Only Policy

**Files:**
- Create: `D:\MyCodingProjects\siyuan-sou-easy\src\features\search-replace\canvas\replacement.ts`
- Modify: `D:\MyCodingProjects\siyuan-sou-easy\src\features\search-replace\store\replacement.ts`
- Modify: `D:\MyCodingProjects\siyuan-sou-easy\src\features\search-replace\match-utils.ts`
- Modify: `D:\MyCodingProjects\siyuan-sou-easy\src\i18n\zh_CN.json`
- Modify: `D:\MyCodingProjects\siyuan-sou-easy\src\i18n\en_US.json`
- Test: `D:\MyCodingProjects\siyuan-sou-easy\tests\canvas-replacement.test.ts`

- [ ] **Step 1: Write failing replacement tests**

Create `tests/canvas-replacement.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { replaceCanvasMatchGroups } from '@/features/search-replace/canvas/replacement'

describe('canvas replacement', () => {
  it('groups replacements by canvas text target', async () => {
    const replaceTextRanges = vi.fn(async () => ({ appliedCount: 2, revision: 'r2' }))
    const result = await replaceCanvasMatchGroups({
      getReplacementText: () => 'Beta',
      matches: [
        { start: 0, end: 5, matchedText: 'Alpha', canvas: { targetId: 'node:t1:text', host: { replaceTextRanges } }, replaceable: true, sourceKind: 'canvas' },
        { start: 6, end: 11, matchedText: 'Alpha', canvas: { targetId: 'node:t1:text', host: { replaceTextRanges } }, replaceable: true, sourceKind: 'canvas' },
        { start: 0, end: 5, matchedText: 'Alpha', canvas: { targetId: 'node:f1:note', host: { replaceTextRanges } }, replaceable: false, sourceKind: 'canvas' },
      ] as any,
    })

    expect(replaceTextRanges).toHaveBeenCalledWith('node:t1:text', [
      { start: 0, end: 5, text: 'Beta' },
      { start: 6, end: 11, text: 'Beta' },
    ])
    expect(result).toEqual({ replacedCount: 2, skippedCount: 1 })
  })
})
```

- [ ] **Step 2: Verify red**

Run: `pnpm test tests/canvas-replacement.test.ts`  
Expected: FAIL because module is missing.

- [ ] **Step 3: Implement replacement grouping and store branch**

Add `isCanvasMatch`, `hasCanvasMatches`, `hasUnsupportedCanvasReplacementMatches`. In `replaceCurrentMatch`, if current match is Canvas and not replaceable, show `replaceCanvasNoteUnsupported`; if replaceable, call bridge. In `replaceAllMatches`, group replaceable Canvas matches and skip note/file hits with result message.

- [ ] **Step 4: Verify green**

Run: `pnpm test tests/canvas-replacement.test.ts`  
Expected: PASS.

---

## Task 8: Integration Verification

**Files:**
- All changed files in both repositories.

- [ ] **Step 1: Run targeted tests**

In `D:\MyCodingProjects\siyuan-canvas`:

```powershell
pnpm test tests/canvas-search-bridge.test.ts tests/canvas-workspace.test.ts
```

In `D:\MyCodingProjects\siyuan-sou-easy`:

```powershell
pnpm test tests/canvas-search-blocks.test.ts tests/canvas-search-decoration.test.ts tests/canvas-replacement.test.ts tests/search-engine.test.ts
```

- [ ] **Step 2: Run full test suites**

In both repositories:

```powershell
pnpm test
```

- [ ] **Step 3: Build both plugins**

In both repositories:

```powershell
pnpm build
```

- [ ] **Step 4: Manual smoke test**

Use `D:\MyCodingProjects\siyuan-canvas\sample_canvas\学习观 1-6.canvas`:

1. Open the file in `siyuan-canvas`.
2. Open `siyuan-sou-easy` search panel.
3. Search `学习`; verify text nodes and note/file nodes appear in match count.
4. Navigate next/previous; verify the Canvas node is selected/centered and highlighted.
5. Replace current in a text node; verify the text node changes and Canvas becomes dirty.
6. Try replace on a note/file node; verify it is rejected with a read-only message.
7. Replace all; verify only text-node matches are replaced and skipped count includes note/file hits.

---

## Self-Review

- Spec coverage: active Canvas detection, search, highlight, reveal, text-node replacement, note/file read-only policy, and cross-plugin bridge are represented by Tasks 1-7.
- Placeholder scan: no task relies on undefined “later” work; each task names files, tests, commands, and expected outcomes.
- Type consistency: Canvas target IDs use `node:<nodeId>:<field>` and `edge:<edgeId>:label` consistently across bridge, mapping, decoration, and replacement.
