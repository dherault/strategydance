import type { Directory, InactiveDirectory } from 'strategydance-knowledge'

import type { ClaudeClient, DirectoryCheck } from '~types'

import createConcurrencyLimit from '~utils/createConcurrencyLimit'
import fetchOutbound from '~utils/fetchOutbound'
import logger from '~utils/logger'

import { DIRECTORY_CHECK_BUDGET_MS, DIRECTORY_CHECK_CONCURRENCY } from '~domain/directories/directoryCheckSettings'
import probeDirectory from '~domain/directories/probeDirectory'
import probeDirectoryPage from '~domain/directories/probeDirectoryPage'
import requestDirectoryReview from '~domain/directories/requestDirectoryReview'

type Options = {
  claude: ClaudeClient
  fetch?: typeof fetchOutbound
  // How long the run starts new checks for, and the clock it reads
  budgetMs?: number
  now?: () => number
}

/*
  Checks the directories picked, `DIRECTORY_CHECK_CONCURRENCY` at a time: each one probed, and
  reviewed unless the probe could not reach its root, which needs no review to count, then the
  submission page the review named, if any, probed in turn. None starts once the run's budget is
  spent, so what was checked is written before the worker's deadline: those are given back as not
  checked, and wait for the next run
*/
async function runDirectoryChecks(
  directories: (Directory | InactiveDirectory)[],
  { claude, fetch = fetchOutbound, budgetMs = DIRECTORY_CHECK_BUDGET_MS, now = Date.now }: Options,
) {
  const run = createConcurrencyLimit(DIRECTORY_CHECK_CONCURRENCY)
  const startedAt = now()
  const results = await Promise.all(
    directories.map(directory =>
      run(async (): Promise<DirectoryCheck | null> => {
        if (now() - startedAt > budgetMs) return null

        const probe = await probeDirectory(directory, fetch)

        if (probe.root.outcome === 'unreachable' || probe.root.outcome === 'missing') {
          logger.info(`Directories: ${directory.name} could not be reached: ${probe.root.failure}`)

          return { name: directory.name, directory, probe, review: null, submissionProbe: null }
        }

        const review = await requestDirectoryReview(directory, probe, claude)
        const submissionUrl = review.outcome === 'answered' ? review.answer.submissionUrl : null
        const submissionProbe =
          submissionUrl && submissionUrl !== directory.submissionUrl
            ? await probeDirectoryPage(submissionUrl, fetch)
            : null

        logger.info(
          `Directories: reviewed ${directory.name}: ${review.outcome === 'answered' ? review.answer.verdict : review.failure}`,
        )

        return { name: directory.name, directory, probe, review, submissionProbe }
      }),
    ),
  )

  return {
    checks: results.filter(result => result !== null),
    skipped: directories.filter((_directory, index) => !results[index]).map(({ name }) => name),
  }
}

export default runDirectoryChecks
