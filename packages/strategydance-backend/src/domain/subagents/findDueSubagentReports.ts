type ReportingSubagent = {
  launchAnchorPosition?: number | null
  reportedAt?: string | null
  reportDeliveredAt?: string | null
}

// Whether a subagent's report waits to reach its parent: written, and not delivered yet
export function isWaitingReport(subagent: ReportingSubagent) {
  return Boolean(subagent.reportedAt) && !subagent.reportDeliveredAt
}

/*
  The reports a parent's reaction delivers, of its live subagents, those a retry deleted left out by
  whoever read them: every waiting report of each batch that is complete, a batch being the
  subagents its runs launched on one anchor, so each batch is reacted to whole, and none of a batch
  still working, whose own completion starts the reaction that carries it. In the order given
*/
function findDueSubagentReports<Subagent extends ReportingSubagent>(subagents: readonly Subagent[]): Subagent[] {
  const working = new Set(
    subagents.filter(subagent => !subagent.reportedAt).map(subagent => subagent.launchAnchorPosition ?? null),
  )

  return subagents.filter(subagent => isWaitingReport(subagent) && !working.has(subagent.launchAnchorPosition ?? null))
}

export default findDueSubagentReports
