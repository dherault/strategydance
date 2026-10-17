import { getSubagentReactionSweepMembers, getSubagentReactionSweepOrganizations } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import startDueSubagentReactions from '~domain/subagents/startDueSubagentReactions'

// How many accounts `GetSubagentReactionSweepMembers` reads at a time, its `limit`
const SWEEP_PAGE_SIZE = 100

/*
  The daily sweep's backstop for reactions to subagents' reports that no run's end and no page
  started, a reaction held back by its member's 3 runs above all, with nobody back since: every member
  with a conversation, live and idle, in which a report waits, has their reactions due started in
  each organization (`startDueSubagentReactions`), every one rather than the first, and the reports of
  those full marked delivered.

  The accounts are read a hundred at a time, after the last one read, then each one's organizations.
  A member whose reactions fail is logged and left for the next sweep, and so is the rest when a read
  fails, so the prunes after it still run. Answers how many reactions it started
*/
async function sweepSubagentReactions() {
  let started = 0
  let afterUserId = ''

  for (;;) {
    let users: { id: string }[]

    try {
      users = (await getSubagentReactionSweepMembers(dataConnect, { afterUserId })).data.users
    } catch (error) {
      logger.error('The sweep could not read the members with reactions to start', error)

      break
    }

    for (const { id: userId } of users) {
      try {
        const { data } = await getSubagentReactionSweepOrganizations(dataConnect, { userId })

        for (const { id: organizationId } of data.organizations) {
          started += await startDueSubagentReactions({ organizationId, userId }, { isThorough: true })
        }
      } catch (error) {
        logger.error(`The sweep could not read where ${userId} has reactions to start`, error)
      }
    }

    const last = users.at(-1)

    if (!last || users.length < SWEEP_PAGE_SIZE) break

    afterUserId = last.id
  }

  return { started }
}

export default sweepSubagentReactions
