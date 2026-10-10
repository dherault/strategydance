import type { TaskAssignee } from '~types'

import type { TaskAssignment } from '~domain/tasks/parseTaskAssignee'

// Who does a task, as the module answers it and reads it back: `"agent"`, `"unassigned"`, or
// `"member:<id>"`, as the board's assignment select writes it
function toTaskAssignee({ assigneeId, isAssignedToAgent }: TaskAssignment): TaskAssignee {
  if (isAssignedToAgent) return 'agent'
  if (assigneeId) return `member:${assigneeId}`

  return 'unassigned'
}

export default toTaskAssignee
