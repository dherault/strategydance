import type { ClaudeClient, DirectoryCheckUsage, DirectoryLists } from '~types'

import fetchOutbound from '~utils/fetchOutbound'

import applyDirectoryChecks from '~domain/directories/applyDirectoryChecks'
import formatDirectoryCheckReport from '~domain/directories/formatDirectoryCheckReport'
import runDirectoryChecks from '~domain/directories/runDirectoryChecks'
import selectDirectoriesToCheck from '~domain/directories/selectDirectoriesToCheck'

type Options = {
  claude: ClaudeClient
  count: number
  inactiveCount: number
  // The directories to check instead of a pick, by name
  names?: string[]
  today: string
  fetch?: typeof fetchOutbound
  random?: () => number
}

/*
  A run of the directories' check over the lists given: the directories picked, or named, checked,
  then applied, with the run's report. The checks come back too, so a caller that finds the lists
  changed under it applies them again to the lists it reads afresh
*/
async function checkDirectories(
  lists: DirectoryLists,
  { claude, count, inactiveCount, names, today, fetch = fetchOutbound, random }: Options,
) {
  const selected = names
    ? [...lists.directories, ...lists.inactiveDirectories].filter(({ name }) => names.includes(name))
    : selectDirectoriesToCheck(lists, { count, inactiveCount, today, random })
  const { checks, skipped } = await runDirectoryChecks(selected, { claude, fetch })
  const usage = checks.reduce<DirectoryCheckUsage>(
    (total, { review }) =>
      review
        ? {
            inputTokens: total.inputTokens + review.usage.inputTokens,
            cacheCreationInputTokens: total.cacheCreationInputTokens + review.usage.cacheCreationInputTokens,
            cacheReadInputTokens: total.cacheReadInputTokens + review.usage.cacheReadInputTokens,
            outputTokens: total.outputTokens + review.usage.outputTokens,
          }
        : total,
    { inputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0, outputTokens: 0 },
  )
  const applied = applyDirectoryChecks(lists, checks, today)

  return {
    lists: applied.lists,
    checks,
    skipped,
    usage,
    report: formatDirectoryCheckReport({ today, outcomes: applied.outcomes, skipped, usage }),
  }
}

export default checkDirectories
