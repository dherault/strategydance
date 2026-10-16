/*
  What becomes of a subagent's run waiting for a slot, as the reconcile reads it, and as the
  promotion's own read filters it (`GetSubagentPendingRuns`):

  - `promoted`, once a slot frees: it was launched under its member's membership as it is, nobody
    asked it to stop and its subagent is not deleted
  - `stopped`: it was asked to stop, or its subagent was deleted, which only asks its runs to stop,
    so the promotion skips it and the reconcile ends it stopped rather than give it a slot it would
    stop at
  - `interrupted`: no membership has the `createdAt` it was launched under, its member removed or
    invited back since, which no worker's fence would meet, so the reconcile ends it interrupted

  `membershipCreatedAt` is the member's as it is, or null once they are no member
*/
function decidePendingSubagentRun(
  run: { membershipCreatedAt: string; stopRequestedAt?: string | null; conversation: { deletedAt?: string | null } },
  membershipCreatedAt: string | null,
): 'promoted' | 'stopped' | 'interrupted' {
  if (run.membershipCreatedAt !== membershipCreatedAt) return 'interrupted'
  if (run.stopRequestedAt || run.conversation.deletedAt) return 'stopped'

  return 'promoted'
}

export default decidePendingSubagentRun
