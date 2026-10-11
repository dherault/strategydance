import { Link } from '@tanstack/react-router'
import { SquareKanbanIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useIntl } from 'react-intl'

import type { Task } from '~types'

import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

import readConversationLinkTarget from '~utils/conversation/readConversationLinkTarget'

import conversationMessages from '~data/intl/messages/conversation'

const ICON_CLASS_NAME = 'mr-[3px] inline-block size-[13px] align-[-2px]'

type Props = {
  href: string
  // The link's words, as the agent wrote them
  children: ReactNode
  // The organization's board by task id, or null while it is not read
  tasks: ReadonlyMap<string, Task> | null
}

/*
  A link to a task in Strategy Dance's reply, `task:<id>`: the task's current name with the board's
  icon, opening it in its dialog over the board, whatever the agent wrote. A task the board no
  longer holds, deleted, pruned or never there, is the agent's words struck through and muted, which
  a screen reader hears said. A link naming no task's id is the agent's words, neither linked nor
  struck, and so is every link until the board is read, or when it could not be
*/
function ConversationTaskLink({ href, children, tasks }: Props) {
  const { formatMessage } = useIntl()
  const organizationSlug = useCurrentOrganizationSlug()
  const target = readConversationLinkTarget(href, 'task', tasks)

  if (target.kind === 'words') {
    return (
      <span>
        <SquareKanbanIcon className={ICON_CLASS_NAME} />
        {children}
      </span>
    )
  }

  if (target.kind === 'gone') {
    return (
      <span className="text-muted-foreground line-through">
        <SquareKanbanIcon className={ICON_CLASS_NAME} />
        {children}
        <span className="sr-only"> {formatMessage(conversationMessages.taskGone)}</span>
      </span>
    )
  }

  return (
    <Link
      to="/$organizationSlug/tasks/$taskId"
      params={{ organizationSlug, taskId: target.item.id }}
      className="font-medium text-primary no-underline hover:text-primary-800 hover:underline"
    >
      <SquareKanbanIcon className={ICON_CLASS_NAME} />
      {target.item.name.trim() || children}
    </Link>
  )
}

export default ConversationTaskLink
