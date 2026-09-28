import { type DragEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react'

type Axis = 'vertical' | 'horizontal'

type DropTarget = {
  index: number
  isAfter: boolean
}

type Options = {
  // Each item's key, in the order the list shows them now
  keys: string[]
  // Which way the list runs, which is which half of an item the pointer is over, and which arrow
  // keys move a handle
  axis?: Axis
  // An item's handle arms the drag, so pressing anywhere else in it selects text or clicks as
  // usual. Off, the whole item drags, as a checklist column's label does
  isHandleArmed?: boolean
  // The item at `from` goes to `to`, both indexes into the list as it is now
  onMove: (from: number, to: number) => void
}

const KEYS: Record<Axis, { previous: string, next: string }> = {
  vertical: { previous: 'ArrowUp', next: 'ArrowDown' },
  horizontal: { previous: 'ArrowLeft', next: 'ArrowRight' },
}

/*
  Reorders a list by dragging, with the browser's own drag and drop, and by keyboard: an item's
  handle moves it one place with the arrow keys along the list, and keeps the focus as it goes.

  Spread `getItemProps` on each item, `getHandleProps` on its handle, and read `getDropSide` to
  draw the line where a dragged item would land. Dropping calls `onMove` once, with the index the
  item ends up at, so a caller only ever moves one row.

  The handle a key moved is focused again once the list shows the new order, found by the item's
  key rather than its place: the list may take a moment to re-render, and until it does another
  item's handle still sits where the moved one is going
*/
function useDragReorder({ keys, axis = 'vertical', isHandleArmed = true, onMove }: Options) {
  const [armedIndex, setArmedIndex] = useState<number | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const handlesRef = useRef(new Map<string, HTMLElement>())
  const pendingFocusKeyRef = useRef<string | null>(null)

  const order = keys.join('\n')

  useEffect(() => {
    const key = pendingFocusKeyRef.current

    if (key === null) return

    pendingFocusKeyRef.current = null
    handlesRef.current.get(key)?.focus()
  }, [order])

  function reset() {
    setArmedIndex(null)
    setDraggedIndex(null)
    setDropTarget(null)
  }

  function drop() {
    if (draggedIndex !== null && dropTarget) {
      const insertion = dropTarget.index + (dropTarget.isAfter ? 1 : 0)
      const destination = insertion > draggedIndex ? insertion - 1 : insertion

      if (destination !== draggedIndex) onMove(draggedIndex, destination)
    }

    reset()
  }

  function getItemProps(index: number) {
    return {
      draggable: isHandleArmed ? armedIndex === index : true,
      onDragStart: (event: DragEvent<HTMLElement>) => {
        setDraggedIndex(index)
        event.dataTransfer.effectAllowed = 'move'
        // Firefox starts no drag without data
        event.dataTransfer.setData('text/plain', String(index))
      },
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (draggedIndex === null) return

        event.preventDefault()

        const rect = event.currentTarget.getBoundingClientRect()
        const isAfter = axis === 'vertical'
          ? event.clientY > rect.top + rect.height / 2
          : event.clientX > rect.left + rect.width / 2

        if (dropTarget?.index !== index || dropTarget.isAfter !== isAfter) setDropTarget({ index, isAfter })
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        event.preventDefault()
        drop()
      },
      // Fires after a drop, which has already reset, and after a drag let go anywhere else,
      // which moves nothing
      onDragEnd: reset,
    }
  }

  function getHandleProps(index: number) {
    const key = keys[index] ?? ''

    return {
      ref: (element: HTMLElement | null) => {
        if (element) handlesRef.current.set(key, element)
        else if (handlesRef.current.get(key)) handlesRef.current.delete(key)
      },
      onPointerDown: () => setArmedIndex(index),
      onPointerUp: () => {
        if (draggedIndex === null) setArmedIndex(null)
      },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        const { previous, next } = KEYS[axis]

        if (event.key !== previous && event.key !== next) return

        event.preventDefault()

        const destination = index + (event.key === previous ? -1 : 1)

        if (destination < 0 || destination >= keys.length) return

        pendingFocusKeyRef.current = key
        onMove(index, destination)
      },
    }
  }

  // Which side of an item the dragged one would land on, or null when it would not land there
  function getDropSide(index: number) {
    if (draggedIndex === null || !dropTarget || dropTarget.index !== index || draggedIndex === index) return null

    return dropTarget.isAfter ? 'after' : 'before'
  }

  return {
    draggedIndex,
    getItemProps,
    getHandleProps,
    getDropSide,
  }
}

export default useDragReorder
