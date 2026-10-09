import { useIntl } from 'react-intl'
import { Select } from 'strategydance-design-system/components/ui/Select'

import type { OrganizationMember, Task } from '~types'

import parseTaskAssigneeValue from '~utils/task/parseTaskAssigneeValue'
import toTaskAssigneeValue from '~utils/task/toTaskAssigneeValue'
import getMemberName from '~utils/team/getMemberName'

import TaskAssigneeAvatar from '~components/task/TaskAssigneeAvatar'

import taskMessages from '~data/intl/messages/task'

type Props = {
  value: Pick<Task, 'assigneeId' | 'isAssignedToAgent'>
  members: readonly OrganizationMember[]
  viewerId: string | null
  onChange: (assignee: Pick<Task, 'assigneeId' | 'isAssignedToAgent'>) => void
}

// Who is doing a task: nobody, Strategy Dance, or one of the organization's members, the reader
// among them saying so, each with their face
function TaskAssigneeSelect({ value, members, viewerId, onChange }: Props) {
  const { formatMessage } = useIntl()

  function renderOption(label: string, member: OrganizationMember | null, isAgent = false) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <TaskAssigneeAvatar
          member={member}
          isAgent={isAgent}
        />
        <span className="truncate">{label}</span>
      </span>
    )
  }

  return (
    <Select
      label={formatMessage(taskMessages.assignee)}
      value={toTaskAssigneeValue(value)}
      options={[
        { value: 'unassigned', label: formatMessage(taskMessages.unassigned) },
        { value: 'agent', label: renderOption(formatMessage(taskMessages.strategyDance), null, true) },
        ...members.map(member => ({
          value: toTaskAssigneeValue({ assigneeId: member.user.id, isAssignedToAgent: false }),
          label: renderOption(
            member.user.id === viewerId
              ? formatMessage(taskMessages.memberYou, { name: getMemberName(member) })
              : getMemberName(member),
            member,
          ),
        })),
      ]}
      onValueChange={next => onChange(parseTaskAssigneeValue(next))}
    />
  )
}

export default TaskAssigneeSelect
