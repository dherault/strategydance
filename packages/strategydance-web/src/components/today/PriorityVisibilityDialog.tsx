import { GripVerticalIcon } from 'lucide-react'
import { useState } from 'react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'strategydance-design-system/components/ui/Dialog'
import { Switch } from 'strategydance-design-system/components/ui/Switch'
import { cn } from 'strategydance-design-system/lib/utils'

import type { OrganizationMember, TodayPreferences } from '~types'

import useDragReorder from '~hooks/common/useDragReorder'

import getMemberName from '~utils/team/getMemberName'

import TodayMemberIdentity from '~components/today/TodayMemberIdentity'

import todayMessages from '~data/intl/messages/today'

type Props = {
  // The team in the order the reader sees it now
  members: OrganizationMember[]
  hiddenPriorities: string[]
  viewerId: string
  // Called once, as it closes, with what the reader chose: every id is a current member's, and
  // the reader's own is never hidden
  onClose: (preferences: TodayPreferences) => void
}

/*
  Chooses whose top priority shows on the reader's Today page, and in what order. Nothing is saved
  until it closes, however it closes, so dragging and flipping several switches is one write.

  The reader's own priority always shows: their switch is on and cannot be turned off
*/
function PriorityVisibilityDialog({ members, hiddenPriorities, viewerId, onClose }: Props) {
  const { formatMessage } = useIntl()

  const [orderedMembers, setOrderedMembers] = useState(members)
  const [hiddenIds, setHiddenIds] = useState(() => new Set(hiddenPriorities.filter(userId => userId !== viewerId)))

  const { draggedIndex, getItemProps, getHandleProps, getDropSide } = useDragReorder({
    keys: orderedMembers.map(({ user }) => user.id),
    onMove: (from, to) => setOrderedMembers(current => {
      const next = [...current]
      const [moved] = next.splice(from, 1)

      if (moved) next.splice(to, 0, moved)

      return next
    }),
  })

  const memberIds = new Set(orderedMembers.map(({ user }) => user.id))
  const visibleCount = orderedMembers.filter(({ user }) => !hiddenIds.has(user.id)).length

  function toggle(userId: string) {
    setHiddenIds(current => {
      const next = new Set(current)

      if (next.has(userId)) next.delete(userId)
      else next.add(userId)

      return next
    })
  }

  function close() {
    onClose({
      priorityOrder: orderedMembers.map(({ user }) => user.id),
      // Only people on the team, so the list never keeps somebody who left
      hiddenPriorities: [...hiddenIds].filter(userId => memberIds.has(userId)),
    })
  }

  return (
    <Dialog
      open
      onOpenChange={open => !open && close()}
    >
      <DialogContent
        closeLabel={formatMessage(todayMessages.close)}
        className="max-h-[calc(100svh-48px)] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-[480px]"
      >
        <DialogHeader>
          <DialogTitle>
            {formatMessage(todayMessages.visibilityDialogTitle)}
          </DialogTitle>
          <DialogDescription>
            {formatMessage(todayMessages.visibilityDialogDescription)}
          </DialogDescription>
        </DialogHeader>
        <ul className="m-0 -mx-6 flex list-none flex-col overflow-y-auto px-6 py-0">
          {orderedMembers.map((member, index) => {
            const userId = member.user.id
            const isViewer = userId === viewerId
            const name = getMemberName(member)
            const switchId = `priority-visibility-${userId}`
            const dropSide = getDropSide(index)

            return (
              <li
                key={userId}
                className={cn(
                  'flex items-center gap-3 border-b border-neutral-100 py-2.5 last:border-b-0',
                  draggedIndex === index && 'opacity-40',
                  dropSide === 'before' && 'shadow-[inset_0_2px_0_var(--color-primary)]',
                  dropSide === 'after' && 'shadow-[inset_0_-2px_0_var(--color-primary)]',
                )}
                {...getItemProps(index)}
              >
                <label
                  htmlFor={switchId}
                  className="flex min-w-0 flex-1 cursor-pointer items-center"
                >
                  <TodayMemberIdentity member={member} />
                </label>
                <span className="flex flex-none items-center gap-2">
                  <Switch
                    id={switchId}
                    checked={isViewer || !hiddenIds.has(userId)}
                    disabled={isViewer}
                    onChange={() => toggle(userId)}
                    aria-label={formatMessage(todayMessages.showPriority, { name })}
                  />
                  <button
                    type="button"
                    className="inline-flex size-7 cursor-grab items-center justify-center rounded-xs text-neutral-400 transition-colors duration-150 ease-in-out hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary active:cursor-grabbing [&_svg]:size-4"
                    aria-label={formatMessage(todayMessages.reorderPriority, { name, position: index + 1, total: orderedMembers.length })}
                    {...getHandleProps(index)}
                  >
                    <GripVerticalIcon aria-hidden="true" />
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
        <DialogFooter className="-mx-6 -mb-6 items-center border-t border-border px-6 py-4 sm:justify-between">
          <span className="text-sm text-muted-foreground">
            {formatMessage(todayMessages.visibleCount, { visible: visibleCount, total: orderedMembers.length })}
          </span>
          <Button onClick={close}>
            {formatMessage(todayMessages.done)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default PriorityVisibilityDialog
