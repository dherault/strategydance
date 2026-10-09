import { Outlet, createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'
import TaskBoard from '~components/task/TaskBoard'
import TaskBoardWait from '~components/task/TaskBoardWait'

// At module scope so the reference is stable across renders
const TASK_MESSAGE_TYPES: MessageType[] = ['task']

export const Route = createFileRoute('/_authenticated/_app/$organizationSlug/tasks')({
  component: TasksRoute,
})

/*
  The current organization's board, and under it the task opened from it, whose dialog lies over
  the board rather than replacing it. The waiter is keyed by the organization, so switching
  organizations mounts the board anew, without the filters or a draft of the one before
*/
function TasksRoute() {
  const { organization } = useCurrentOrganization()

  return (
    <IntlMessagesRegistration messageTypes={TASK_MESSAGE_TYPES}>
      <TaskBoardWait key={organization?.id ?? 'none'}>
        <TaskBoard />
        <Outlet />
      </TaskBoardWait>
    </IntlMessagesRegistration>
  )
}
