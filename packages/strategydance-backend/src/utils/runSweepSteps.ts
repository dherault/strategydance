import logger from '~utils/logger'

/*
  Runs a sweep's steps one after the other, each on its own: one that throws is logged and the next
  runs anyway, so a prune that fails, Claude's Files API down say, never keeps the steps after it
  from running. Answers the names of those that failed, which the route answers with, so Cloud
  Scheduler records the sweep failed and the next one finishes it, every step being idempotent
*/
async function runSweepSteps(steps: Record<string, () => Promise<unknown>>) {
  const failed: string[] = []

  for (const [name, step] of Object.entries(steps)) {
    try {
      await step()
    } catch (error) {
      logger.error(`The sweep's step ${name} failed, and the steps after it run anyway`, error)

      failed.push(name)
    }
  }

  return failed
}

export default runSweepSteps
