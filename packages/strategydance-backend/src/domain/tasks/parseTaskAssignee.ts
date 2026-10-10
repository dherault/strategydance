import type { ModuleCaller } from '~types'

// Who does a task as its row stores it: a member, Strategy Dance itself, or nobody, never two at once
export type TaskAssignment = {
  assigneeId: string | null
  isAssignedToAgent: boolean
}

/*
  Who does a task, as the module reads one named: `"me"`, the caller, `"agent"`, Strategy Dance
  itself, `"unassigned"`, nobody, or `"member:<id>"`, a member, as the board's assignment select
  writes one, so no member's id is read as one of the words. Whether that member belongs to the
  organization is the operation's to check
*/
function parseTaskAssignee(value: string, caller: ModuleCaller): TaskAssignment {
  if (value === 'me') return { assigneeId: caller.userId, isAssignedToAgent: false }
  if (value === 'agent') return { assigneeId: null, isAssignedToAgent: true }
  if (value.startsWith('member:')) return { assigneeId: value.slice('member:'.length), isAssignedToAgent: false }

  return { assigneeId: null, isAssignedToAgent: false }
}

export default parseTaskAssignee
