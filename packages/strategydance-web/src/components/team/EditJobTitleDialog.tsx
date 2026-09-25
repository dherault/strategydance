import { type FormEvent, useState } from 'react'
import { useIntl } from 'react-intl'
import { MAX_JOB_TITLE_LENGTH } from 'strategydance-core'
import { useUpdateOrganizationMemberJobTitle } from 'strategydance-database/web/react'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'strategydance-design-system/components/ui/Dialog'
import { Input } from 'strategydance-design-system/components/ui/Input'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import type { OrganizationMember } from '~types'

import getMemberName from '~utils/team/getMemberName'

import Spinner from '~components/common/Spinner'

import { dataConnect } from '~data/firebase'
import teamMessages from '~data/intl/messages/team'

type Props = {
  organizationId: string
  organizationName: string
  member: OrganizationMember
  isViewer: boolean
  onClose: () => void
}

/*
  Writes what a member does. Mounted only while open, so it starts from the member's current title
  every time. An emptied field clears the title rather than saving an empty string, and Save waits
  for a change
*/
function EditJobTitleDialog({ organizationId, organizationName, member, isViewer, onClose }: Props) {
  const { formatMessage } = useIntl()
  const { mutateAsync: updateJobTitle, isPending } = useUpdateOrganizationMemberJobTitle(dataConnect)

  const [jobTitle, setJobTitle] = useState(member.jobTitle ?? '')
  const [hasFailed, setHasFailed] = useState(false)

  const name = getMemberName(member)
  const trimmedJobTitle = jobTitle.trim()
  const hasChanged = trimmedJobTitle !== (member.jobTitle ?? '')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!hasChanged || isPending) return

    setHasFailed(false)

    try {
      await updateJobTitle({
        organizationId,
        userId: member.user.id,
        jobTitle: trimmedJobTitle || null,
      })

      toast.success(formatMessage(teamMessages.jobTitleUpdated))
      onClose()
    }
    catch (error) {
      console.error('Failed to save the job title', error)

      // What was typed stays where it was typed
      setHasFailed(true)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={open => !open && onClose()}
    >
      <DialogContent
        closeLabel={formatMessage(teamMessages.close)}
        className="sm:max-w-[420px]"
      >
        <form
          onSubmit={handleSubmit}
          className="grid gap-6"
        >
          <DialogHeader>
            <DialogTitle>
              {formatMessage(isViewer ? teamMessages.editOwnJobTitle : teamMessages.editJobTitle)}
            </DialogTitle>
            <DialogDescription>
              {isViewer
                ? formatMessage(teamMessages.editOwnJobTitleDescription, { organizationName })
                : formatMessage(teamMessages.editJobTitleDescription, { name, organizationName })}
            </DialogDescription>
          </DialogHeader>
          <Input
            label={formatMessage(teamMessages.jobTitleLabel)}
            value={jobTitle}
            onChange={event => setJobTitle(event.target.value)}
            placeholder={formatMessage(teamMessages.jobTitlePlaceholder)}
            maxLength={MAX_JOB_TITLE_LENGTH}
            error={hasFailed ? formatMessage(teamMessages.jobTitleError) : undefined}
            autoComplete="organization-title"
            autoFocus
          />
          <DialogFooter className="-mx-6 -mb-6 border-t border-border px-6 py-4">
            <Button
              variant="transparent"
              onClick={onClose}
            >
              {formatMessage(teamMessages.cancel)}
            </Button>
            <Button
              type="submit"
              disabled={!hasChanged || isPending}
              icon={isPending ? <Spinner tone="current" /> : undefined}
            >
              {formatMessage(teamMessages.save)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default EditJobTitleDialog
