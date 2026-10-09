import { useNavigate } from '@tanstack/react-router'
import { type PropsWithChildren, useEffect } from 'react'

import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'
import useTasks from '~hooks/task/useTasks'

type Props = PropsWithChildren<{
  taskId: string
}>

/*
  Sits under `TaskBoardWait`, so the board has landed: an address naming a task the board does not
  hold, never there or deleted since, by the reader or a teammate, goes back to the board in its
  place rather than to a not found page. A board that failed to load says so itself, under it
*/
function TaskBouncer({ taskId, children }: Props) {
  const navigate = useNavigate()
  const organizationSlug = useCurrentOrganizationSlug()
  const { data: tasks, hasFailed } = useTasks()

  const isGone = !hasFailed && !tasks.some(({ id }) => id === taskId)

  useEffect(() => {
    if (isGone)
      navigate({ to: '/$organizationSlug/tasks', params: { organizationSlug }, replace: true, resetScroll: false })
  }, [isGone, organizationSlug, navigate])

  if (isGone || hasFailed) return null

  return children
}

export default TaskBouncer
