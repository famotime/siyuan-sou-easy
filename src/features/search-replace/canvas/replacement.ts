import { preserveReplacementCase } from '../preserve-case'
import type { SearchMatch } from '../types'

export async function replaceCanvasMatchGroups({
  getReplacementText,
  matches,
  preserveCase = false,
}: {
  getReplacementText: (match: SearchMatch) => string
  matches: SearchMatch[]
  preserveCase?: boolean
}) {
  const groups = new Map<string, {
    host: NonNullable<SearchMatch['canvas']>['host']
    matches: SearchMatch[]
  }>()
  let skippedCount = 0

  matches.forEach((match) => {
    const targetId = match.canvas?.targetId
    const host = match.canvas?.host
    if (match.sourceKind !== 'canvas' || !targetId || !host || !match.replaceable) {
      skippedCount += 1
      return
    }

    const group = groups.get(targetId) ?? {
      host,
      matches: [],
    }
    group.matches.push(match)
    groups.set(targetId, group)
  })

  let replacedCount = 0
  for (const [targetId, group] of groups) {
    if (!group.host) {
      skippedCount += group.matches.length
      continue
    }

    const result = await group.host.replaceTextRanges(
      targetId,
      group.matches.map(match => ({
        end: match.end,
        start: match.start,
        text: preserveCase
          ? preserveReplacementCase(getReplacementText(match), match.matchedText)
          : getReplacementText(match),
      })),
    )
    replacedCount += result.appliedCount
    skippedCount += Math.max(0, group.matches.length - result.appliedCount)
  }

  return {
    replacedCount,
    skippedCount,
  }
}
