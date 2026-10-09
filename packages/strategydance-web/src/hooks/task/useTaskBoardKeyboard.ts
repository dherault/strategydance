import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { useIntl } from 'react-intl'
import type { TaskStatus } from 'strategydance-database/web'

import type { Task } from '~types'

import { TASK_STATUSES } from '~constants'

import taskMessages from '~data/intl/messages/task'
import taskStatusMessages from '~data/intl/taskStatusMessages'

type Options = {
  // Each column's tasks as the board shows them, in order
  columns: ReadonlyMap<TaskStatus, readonly Task[]>
  // The task goes into a column, before a task or past the last
  onMove: (taskId: string, status: TaskStatus, beforeId: string | null) => void
}

/*
  Moves cards from the keyboard, as dragging does with a pointer: Alt with the up and down arrows
  moves a focused card one place within its column, and with the left and right arrows into the
  column beside it, at the same height. The focus stays on the card once the board shows it where
  it went, found by its id, and where it went is announced: its column, and its place in it
*/
function useTaskBoardKeyboard({ columns, onMove }: Options) {
  const { formatMessage } = useIntl()
  const [announcement, setAnnouncement] = useState('')
  const pendingFocusRef = useRef<string | null>(null)

  const order = TASK_STATUSES.map(status => (columns.get(status) ?? []).map(({ id }) => id).join(',')).join('|')

  useEffect(() => {
    const taskId = pendingFocusRef.current
    const link = taskId ? document.querySelector<HTMLElement>(`[data-task-id="${taskId}"] a`) : null

    if (!link) return

    pendingFocusRef.current = null
    link.focus()
  }, [order])

  function getCardKeyDown(task: Task) {
    return (event: KeyboardEvent<HTMLElement>) => {
      if (!event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return

      const column = columns.get(task.status) ?? []
      const index = column.findIndex(({ id }) => id === task.id)
      let status = task.status
      let beforeId: string | null
      let position: number
      let count = column.length

      if (event.key === 'ArrowUp') {
        if (index <= 0) return

        beforeId = column[index - 1]!.id
        position = index
      } else if (event.key === 'ArrowDown') {
        if (index < 0 || index >= column.length - 1) return

        beforeId = column[index + 2]?.id ?? null
        position = index + 2
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const next = TASK_STATUSES[TASK_STATUSES.indexOf(task.status) + (event.key === 'ArrowLeft' ? -1 : 1)]

        if (!next) return

        const target = columns.get(next) ?? []

        status = next
        beforeId = target[index]?.id ?? null
        position = Math.min(index, target.length) + 1
        count = target.length + 1
      } else {
        return
      }

      event.preventDefault()
      pendingFocusRef.current = task.id
      onMove(task.id, status, beforeId)
      setAnnouncement(
        formatMessage(taskMessages.moved, {
          name: task.name,
          status: formatMessage(taskStatusMessages[status]),
          position,
          count,
        }),
      )
    }
  }

  return { announcement, getCardKeyDown }
}

export default useTaskBoardKeyboard
