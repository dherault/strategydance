import { useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { useIntl } from 'react-intl'
import { MAX_TOP_PRIORITY_LENGTH } from 'strategydance-core'
import type { GetOrganizationTeamData } from 'strategydance-database/web'
import { useUpdateTopPriority } from 'strategydance-database/web/react'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'strategydance-design-system/components/ui/Dialog'
import { Textarea } from 'strategydance-design-system/components/ui/Textarea'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import Spinner from '~components/common/Spinner'

import { dataConnect } from '~data/firebase'
import todayMessages from '~data/intl/messages/today'

type Props = {
  organizationId: string
  viewerId: string
  topPriority: string | null
  onClose: () => void
}

// A priority is one line, so a newline typed or pasted into the field becomes a space
function toOneLine(value: string) {
  return value.replace(/\s*[\r\n]+\s*/g, ' ')
}

/*
  Writes the reader's top priority. Mounted only while open, so it starts from the priority they
  have every time. Enter saves, since a priority is one line, and an emptied field clears it.

  The team's live query pushes the change to everybody, the reader included, but the reader's own
  card is written at once rather than after that round trip
*/
function TopPriorityDialog({ organizationId, viewerId, topPriority, onClose }: Props) {
  const { formatMessage } = useIntl()
  const queryClient = useQueryClient()
  const { mutateAsync: updateTopPriority, isPending } = useUpdateTopPriority(dataConnect)

  const [value, setValue] = useState(topPriority ?? '')
  const [hasFailed, setHasFailed] = useState(false)

  const trimmedValue = value.trim()
  const hasChanged = trimmedValue !== (topPriority ?? '')

  async function save() {
    if (!hasChanged || isPending) return

    setHasFailed(false)

    const nextTopPriority = trimmedValue || null

    try {
      await updateTopPriority({ organizationId, topPriority: nextTopPriority })

      queryClient.setQueryData<GetOrganizationTeamData>(['GetOrganizationTeam', organizationId], team => team && {
        ...team,
        userOrganizations: team.userOrganizations.map(member => (member.user.id === viewerId ? { ...member, topPriority: nextTopPriority } : member)),
      })
      toast.success(formatMessage(todayMessages.priorityUpdated))
      onClose()
    }
    catch (error) {
      console.error('Failed to save the top priority', error)

      // What was typed stays where it was typed
      setHasFailed(true)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    save()
  }

  return (
    <Dialog
      open
      onOpenChange={open => !open && onClose()}
    >
      <DialogContent
        closeLabel={formatMessage(todayMessages.close)}
        className="sm:max-w-[480px]"
      >
        <form
          onSubmit={handleSubmit}
          className="grid gap-6"
        >
          <DialogHeader>
            <DialogTitle>
              {formatMessage(todayMessages.priorityDialogTitle)}
            </DialogTitle>
            <DialogDescription>
              {formatMessage(todayMessages.priorityDialogDescription)}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            label={formatMessage(todayMessages.priorityLabel)}
            value={value}
            onChange={event => setValue(toOneLine(event.target.value))}
            onKeyDown={event => {
              if (event.key !== 'Enter' || event.nativeEvent.isComposing) return

              event.preventDefault()
              save()
            }}
            placeholder={formatMessage(todayMessages.priorityPlaceholder)}
            maxLength={MAX_TOP_PRIORITY_LENGTH}
            rows={3}
            hint={formatMessage(todayMessages.priorityLength, { length: value.length, max: MAX_TOP_PRIORITY_LENGTH })}
            error={hasFailed ? formatMessage(todayMessages.priorityError) : undefined}
            // Starts with the cursor after what is there, to carry on from it
            onFocus={event => event.currentTarget.setSelectionRange(event.currentTarget.value.length, event.currentTarget.value.length)}
            autoFocus
          />
          <DialogFooter className="-mx-6 -mb-6 border-t border-border px-6 py-4">
            <Button
              variant="transparent"
              onClick={onClose}
            >
              {formatMessage(todayMessages.cancel)}
            </Button>
            <Button
              type="submit"
              disabled={!hasChanged || isPending}
              icon={isPending ? <Spinner tone="current" /> : undefined}
            >
              {formatMessage(todayMessages.save)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default TopPriorityDialog
