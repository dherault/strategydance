import deriveUuid from '~utils/deriveUuid'

// The id of the run a subagent's run chains to, derived from it, so a worker that lost the chain's
// answer, or a delivery that finds the run chained, queues the same next run
function deriveChainedRunId(runId: string) {
  return deriveUuid(runId, 'chain')
}

export default deriveChainedRunId
