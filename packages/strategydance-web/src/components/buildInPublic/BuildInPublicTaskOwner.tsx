import { useIntl } from 'react-intl'

import type { OrganizationMember, Task } from '~types'

import BuildInPublicAgentAvatar from '~components/buildInPublic/BuildInPublicAgentAvatar'
import BuildInPublicPerson from '~components/buildInPublic/BuildInPublicPerson'

import buildInPublicMessages from '~data/intl/messages/buildInPublic'
import taskMessages from '~data/intl/messages/task'

type Props = {
  task: Pick<Task, 'assigneeId' | 'isAssignedToAgent'>
  members: readonly OrganizationMember[]
  // The agent's mark on a white circle, as the design draws it on the accent and navy cards
  isInverted?: boolean
  className?: string
}

/*
  Who is doing a task, on a card: Strategy Dance as an AI teammate, or the member by the name they
  gave, since a card is posted for anybody to see. Nothing for a task nobody is doing, or a member
  who gave no name
*/
function BuildInPublicTaskOwner({ task, members, isInverted, className }: Props) {
  const { formatMessage } = useIntl()

  if (task.isAssignedToAgent) {
    return (
      <BuildInPublicPerson
        name={formatMessage(taskMessages.strategyDance)}
        imageUrl={null}
        jobTitle={formatMessage(buildInPublicMessages.agentRole)}
        avatar={<BuildInPublicAgentAvatar isInverted={isInverted} />}
        className={className}
      />
    )
  }

  const member = members.find(teamMember => teamMember.user.id === task.assigneeId)

  if (!member?.user.displayName) return null

  return (
    <BuildInPublicPerson
      name={member.user.displayName}
      imageUrl={member.user.imageUrl ?? null}
      jobTitle={member.jobTitle ?? null}
      className={className}
    />
  )
}

export default BuildInPublicTaskOwner
