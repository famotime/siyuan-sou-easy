import {
  applyReplacementsToClone,
  getBlockElement,
} from './editor'
import { updateDomBlock } from './kernel'
import type {
  EditorContext,
  SearchMatch,
} from './types'

interface ReplaceOptions {
  preserveCase?: boolean
}

type ReplacementCandidate = Pick<SearchMatch, 'matchedText' | 'start' | 'end'>

export type PreparedBlockReplacement =
  | {
    status: 'missing-block'
    blockId: string
    matchCount: number
  }
  | {
    status: 'not-replaceable'
    blockId: string
    matchCount: number
  }
  | {
    status: 'ready'
    appliedCount: number
    blockId: string
    matchCount: number
    outerHTML: string
  }

export function groupMatchesByBlock(matches: SearchMatch[], rootId: string) {
  const groupedMatches = new Map<string, SearchMatch[]>()

  matches.forEach((match) => {
    if (match.rootId !== rootId) {
      return
    }

    const group = groupedMatches.get(match.blockId) ?? []
    group.push(match)
    groupedMatches.set(match.blockId, group)
  })

  return groupedMatches
}

export function prepareBlockReplacement(
  context: EditorContext,
  blockId: string,
  matches: ReplacementCandidate[],
  replacementText: string,
  options?: ReplaceOptions,
): PreparedBlockReplacement {
  const blockElement = getBlockElement(context, blockId)
  if (!blockElement) {
    return {
      status: 'missing-block',
      blockId,
      matchCount: matches.length,
    }
  }

  const outcome = applyReplacementsToClone(blockElement, matches, replacementText, options)
  if (!outcome.clone || outcome.appliedCount === 0) {
    return {
      status: 'not-replaceable',
      blockId,
      matchCount: matches.length,
    }
  }

  return {
    status: 'ready',
    appliedCount: outcome.appliedCount,
    blockId,
    matchCount: matches.length,
    outerHTML: outcome.clone.outerHTML,
  }
}

export async function applyPreparedBlockReplacement(replacement: Extract<PreparedBlockReplacement, { status: 'ready' }>) {
  await updateDomBlock(replacement.blockId, replacement.outerHTML)
}
