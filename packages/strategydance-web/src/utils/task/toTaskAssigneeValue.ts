import type { Task } from '~types'

// A task's assignee as one of the assignee select's values: nobody, Strategy Dance, or a member by
// their uid behind a prefix, since the select reserves the empty string and a uid could otherwise
// read as one of the other two
function toTaskAssigneeValue({ assigneeId, isAssignedToAgent }: Pick<Task, 'assigneeId' | 'isAssignedToAgent'>) {
  if (isAssignedToAgent) return 'agent'
  if (assigneeId) return `member:${assigneeId}`

  return 'unassigned'
}

export default toTaskAssigneeValue
