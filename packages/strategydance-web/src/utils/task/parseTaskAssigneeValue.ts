// The assignee one of the assignee select's values stands for, as `toTaskAssigneeValue` writes it
function parseTaskAssigneeValue(value: string) {
  if (value === 'agent') return { assigneeId: null, isAssignedToAgent: true }
  if (value.startsWith('member:')) return { assigneeId: value.slice('member:'.length), isAssignedToAgent: false }

  return { assigneeId: null, isAssignedToAgent: false }
}

export default parseTaskAssigneeValue
