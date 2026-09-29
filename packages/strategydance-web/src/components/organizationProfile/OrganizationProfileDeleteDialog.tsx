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
import organizationProfileMessages from '~data/intl/messages/organizationProfile'

type Props = {
  organizationId: string
  organizationName: string
  onClose: () => void
}

/*
  Deletes the organization, after a second click on the button that says so. The backend deletes
  the organization's files, then the row, which takes the memberships and invitations with it.

  Then away from a page about an organization that is gone, before the memberships drop it: the
  other way round, the current organization would move on to the next one while this page is
  still up, and show that one's profile for a moment. The persisted choice needs no clearing,
  since an id that matches no membership falls through to the first one
*/
function OrganizationProfileDeleteDialog({ organizationId, organizationName, onClose }: Props) {
  const { formatMessage } = useIntl()
  const navigate = useNavigate()
  const { forgetOrganization } = useUserOrganizations()

  const [isDeleting, setIsDeleting] = useState(false)

  async function deleteOrganization() {
    if (isDeleting) return

    setIsDeleting(true)

    try {
      await requestApi({
        method: 'DELETE',
        path: `/organizations/${organizationId}`,
      })
    } catch (error) {
      console.error('Failed to delete the organization', error)

      toast.error(formatMessage(organizationProfileMessages.deleteError))
      setIsDeleting(false)

      return
    }

    toast.success(formatMessage(organizationProfileMessages.deleted))

    await navigate({ to: '/today', replace: true })
    await forgetOrganization(organizationId)
  }

  return (
    <Dialog
      open
      onOpenChange={open => !open && !isDeleting && onClose()}
    >
      <DialogContent
        role="alertdialog"
        closeLabel={formatMessage(organizationProfileMessages.close)}
        className="sm:max-w-[420px]"
      >
        <DialogHeader>
          <DialogTitle>{formatMessage(organizationProfileMessages.deleteOrganization)}</DialogTitle>
          <DialogDescription>
            {formatMessage(organizationProfileMessages.deleteDescription, { organizationName })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="-mx-6 -mb-6 border-t border-border px-6 py-4">
          <Button
            variant="transparent"
            disabled={isDeleting}
            onClick={onClose}
          >
            {formatMessage(organizationProfileMessages.cancel)}
          </Button>
          <Button
            variant="danger"
            confirm={formatMessage(organizationProfileMessages.deleteConfirm)}
            disabled={isDeleting}
            icon={isDeleting ? <Spinner tone="current" /> : undefined}
            onClick={deleteOrganization}
          >
            {formatMessage(organizationProfileMessages.deleteOrganization)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default OrganizationProfileDeleteDialog
