import { type DragEvent, useState } from 'react'
import type { TaskStatus } from 'strategydance-database/web'

import type { Task } from '~types'

import isTaskDropInPlace from '~utils/task/isTaskDropInPlace'

type DropTarget = {
  status: TaskStatus
  // The card the dragged one would land before, or null for the column's end
  beforeId: string | null
}

type Options = {
  // The dragged task goes into a column, before a card or past the last
  onMove: (taskId: string, status: TaskStatus, beforeId: string | null) => void
}

/*
  Moves cards between the board's columns, and within one, with the browser's own drag and drop.
  `useDragReorder` does one list; this one does several, a card landing before the first card of
  its column whose middle is below the pointer.

  Spread `getCardProps` on each card and `getColumnProps` on each column, and read `getDropMarker`
  to draw the line where the card would land. Dropping calls `onMove` once. A card dragged out of
  the board, or let go where it already sits among the cards its column shows, moves nothing, so a
  drop that changes nothing in sight never moves it past cards the filters hide.

  The keyboard moves a card through its dialog's status instead, which says where it went
*/
function useTaskBoardDrag({ onMove }: Options) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)

  function reset() {
    setDraggedId(null)
    setDropTarget(null)
  }

  function getCardProps(taskId: string) {
    return {
      draggable: true,
      'data-task-id': taskId,
      onDragStart: (event: DragEvent<HTMLElement>) => {
        setDraggedId(taskId)
        event.dataTransfer.effectAllowed = 'move'
        // Firefox starts no drag without data
        event.dataTransfer.setData('text/plain', taskId)
      },
      // Fires after a drop, which has already reset, and after a drag let go anywhere else
      onDragEnd: reset,
    }
  }

  function getColumnProps(status: TaskStatus) {
    return {
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (draggedId === null) return

        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'

        const cards = [...event.currentTarget.querySelectorAll<HTMLElement>('[data-task-id]')]
        const before = cards.find(card => {
          const rect = card.getBoundingClientRect()

          return event.clientY < rect.top + rect.height / 2
        })
        const beforeId = before?.dataset.taskId ?? null

        if (dropTarget?.status !== status || dropTarget.beforeId !== beforeId) setDropTarget({ status, beforeId })
      },
      // Only when the pointer leaves the column, not when it crosses from one card to the next
      onDragLeave: (event: DragEvent<HTMLElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null)
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        event.preventDefault()

        const shownIds = [...event.currentTarget.querySelectorAll<HTMLElement>('[data-task-id]')].map(
          card => card.dataset.taskId ?? '',
        )

        if (draggedId !== null && dropTarget && !isTaskDropInPlace(shownIds, draggedId, dropTarget.beforeId)) {
          onMove(draggedId, dropTarget.status, dropTarget.beforeId)
        }

        reset()
      },
    }
  }

  /*
    Where a column draws the line, given the cards it shows: before a card's id, null for its end,
    or undefined for nowhere. Nowhere outside the column the pointer is over, and wherever the drop
    would leave the card where it is
  */
  function getDropMarker(status: TaskStatus, column: readonly Task[]) {
    if (draggedId === null || dropTarget?.status !== status) return undefined

    const shownIds = column.map(task => task.id)

    return isTaskDropInPlace(shownIds, draggedId, dropTarget.beforeId) ? undefined : dropTarget.beforeId
  }

  return {
    draggedId,
    // The column a card is being dragged over, which shows it
    overStatus: dropTarget?.status ?? null,
    getCardProps,
    getColumnProps,
    getDropMarker,
  }
}

export default useTaskBoardDrag
