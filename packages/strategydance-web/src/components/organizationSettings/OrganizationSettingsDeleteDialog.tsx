import { useNavigate } from '@tanstack/react-router'
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
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import useUserOrganizations from '~hooks/userOrganization/useUserOrganizations'

import Spinner from '~components/common/Spinner'

import { requestApi } from '~data/api'
import organizationSettingsMessages from '~data/intl/messages/organizationSettings'

type Props = {
  organizationId: string
  organizationName: string
  onClose: () => void
}

/*
  Deletes the organization, after a second click on the button that says so. The backend deletes
  the row, which takes the memberships and invitations with it, then the organization's files.

  Then away from a page about an organization that is gone, before the memberships are read
  again: read first, the current organization would move on to the next one while this page is
  still up, and show that one's settings for a moment. The persisted choice needs no clearing,
  since an id that matches no membership falls through to the first one
*/
function OrganizationSettingsDeleteDialog({ organizationId, organizationName, onClose }: Props) {
  const { formatMessage } = useIntl()
  const navigate = useNavigate()
  const { refetch } = useUserOrganizations()

  const [isDeleting, setIsDeleting] = useState(false)

  async function deleteOrganization() {
    if (isDeleting) return

    setIsDeleting(true)

    try {
      await requestApi({
        method: 'DELETE',
        path: `/organizations/${organizationId}`,
      })
    }
    catch (error) {
      console.error('Failed to delete the organization', error)

      toast.error(formatMessage(organizationSettingsMessages.deleteError))
      setIsDeleting(false)

      return
    }

    toast.success(formatMessage(organizationSettingsMessages.deleted))

    await navigate({ to: '/-', replace: true })
    await refetch()
  }

  return (
    <Dialog
      open
      onOpenChange={open => !open && !isDeleting && onClose()}
    >
      <DialogContent
        role="alertdialog"
        closeLabel={formatMessage(organizationSettingsMessages.close)}
        className="sm:max-w-[420px]"
      >
        <DialogHeader>
          <DialogTitle>
            {formatMessage(organizationSettingsMessages.deleteOrganization)}
          </DialogTitle>
          <DialogDescription>
            {formatMessage(organizationSettingsMessages.deleteDescription, { organizationName })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="-mx-6 -mb-6 border-t border-border px-6 py-4">
          <Button
            variant="transparent"
            disabled={isDeleting}
            onClick={onClose}
          >
            {formatMessage(organizationSettingsMessages.cancel)}
          </Button>
          <Button
            variant="danger"
            confirm={formatMessage(organizationSettingsMessages.deleteConfirm)}
            disabled={isDeleting}
            icon={isDeleting ? <Spinner tone="current" /> : undefined}
            onClick={deleteOrganization}
          >
            {formatMessage(organizationSettingsMessages.deleteOrganization)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default OrganizationSettingsDeleteDialog
