import type { ConversationSubagent } from '~types'

export type RetriedSubagents = {
  // How many a retry discards, every subagent launched on the anchor the retried run started from
  total: number
  // How many of those it stops first, still busy
  working: number
}

/*
  The subagents a Retry of a run discards: those launched on the anchor it started from, by it or
  the runs carrying it on, reported or not, which the backend deletes as it retries, stopping those
  still busy first, so their reports never reach the conversation while what they changed stays
*/
function countRetriedSubagents(subagents: readonly ConversationSubagent[], anchorPosition: number): RetriedSubagents {
  const retried = subagents.filter(({ launchAnchorPosition }) => launchAnchorPosition === anchorPosition)

  return {
    total: retried.length,
    working: retried.filter(({ activeRunId }) => activeRunId !== null).length,
  }
}

export default countRetriedSubagents
