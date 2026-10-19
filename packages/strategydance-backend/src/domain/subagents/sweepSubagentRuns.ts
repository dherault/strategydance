import { getSubagentSweepMembers, getSubagentSweepOrganizations } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'
import SweepIncomplete from '~utils/SweepIncomplete'

import reconcileSubagentRuns from '~domain/subagents/reconcileSubagentRuns'

// How many accounts `GetSubagentSweepMembers` reads at a time, its `limit`
const SWEEP_PAGE_SIZE = 100

/*
  The backstop of the worker's reconcile, every five minutes, and of the daily sweep, for subagents,
  which no page may reconcile: every member with a subagent run past its lease, or one waiting for a
  slot, in any organization, has their subagent runs there reconciled as a parent's page would
  (`reconcileSubagentRuns`), so a crash, a run whose task never came or a member removed never
  leaves a subagent busy for good.

  The accounts are read a hundred at a time, after the last one read, so however many runs one
  member holds, nobody after them is hidden, and then each one's organizations. A member whose
  reconcile fails is logged and left for the next sweep, and so is the rest when a read fails, so
  the prunes after it still run. Answers how many members it reconciled, or throws once done when
  anything failed (`SweepIncomplete`), so the route reports it
*/
async function sweepSubagentRuns() {
  let reconciled = 0
  let failures = 0
  let afterUserId = ''

  for (;;) {
    let users: { id: string }[]

    try {
      users = (await getSubagentSweepMembers(dataConnect, { afterUserId })).data.users
    } catch (error) {
      logger.error('The sweep could not read the members with subagent runs to reconcile', error)

      failures++

      break
    }

    for (const { id: userId } of users) {
      const member = await reconcileMember(userId)

      reconciled += member.reconciled
      failures += member.failures
    }

    const last = users.at(-1)

    if (!last || users.length < SWEEP_PAGE_SIZE) break

    afterUserId = last.id
  }

  if (failures) throw new SweepIncomplete('sweepSubagentRuns', failures)

  return { reconciled }
}

// Reconciles an account's subagent runs in each organization it has one to reconcile in, answering
// in how many it did, and how many of its reads or reconciles failed
async function reconcileMember(userId: string) {
  let organizations: { id: string }[]

  try {
    organizations = (await getSubagentSweepOrganizations(dataConnect, { userId })).data.organizations
  } catch (error) {
    logger.error(`The sweep could not read where ${userId} has subagent runs to reconcile`, error)

    return { reconciled: 0, failures: 1 }
  }

  let reconciled = 0
  let failures = 0

  for (const { id: organizationId } of organizations) {
    try {
      await reconcileSubagentRuns({ organizationId, userId })

      reconciled++
    } catch (error) {
      logger.error(`The sweep could not reconcile the subagent runs of ${userId}`, error)

      failures++
    }
  }

  return { reconciled, failures }
}

export default sweepSubagentRuns
