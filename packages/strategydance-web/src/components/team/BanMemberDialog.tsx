import { useIntl } from 'react-intl'
import { useRemoveOrganizationMember } from 'strategydance-database/web/react'
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

import type { OrganizationMember } from '~types'

import getMemberName from '~utils/team/getMemberName'

import Spinner from '~components/common/Spinner'

import { dataConnect } from '~data/firebase'
import teamMessages from '~data/intl/messages/team'

type Props = {
  organizationId: string
  organizationName: string
  member: OrganizationMember
  onClose: () => void
}

/*
  Takes a member out of the organization. The dialog is the first confirmation and the button's
  own two-step confirm the second, since this is the one action on the page that locks somebody
  out. Their membership is deleted and nothing else, so they can be invited again, as the dialog
  says
*/
function BanMemberDialog({ organizationId, organizationName, member, onClose }: Props) {
  const { formatMessage } = useIntl()
  const { mutateAsync: removeMember, isPending } = useRemoveOrganizationMember(dataConnect)

  const name = getMemberName(member)

  async function ban() {
    try {
      await removeMember({ organizationId, userId: member.user.id })

      toast.success(formatMessage(teamMessages.banned, { name }))
      onClose()
    }
    catch (error) {
      console.error('Failed to ban the member', error)

      toast.error(formatMessage(teamMessages.banError, { name }))
    }
  }

  return (
    <Dialog
      open
      onOpenChange={open => !open && onClose()}
    >
      <DialogContent
        role="alertdialog"
        closeLabel={formatMessage(teamMessages.close)}
        className="sm:max-w-[420px]"
      >
        <DialogHeader>
          <DialogTitle>
            {formatMessage(teamMessages.banName, { name })}
          </DialogTitle>
          <DialogDescription>
            {formatMessage(teamMessages.banDescription, { name, organizationName })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="-mx-6 -mb-6 border-t border-border px-6 py-4">
          <Button
            variant="transparent"
            onClick={onClose}
          >
            {formatMessage(teamMessages.cancel)}
          </Button>
          <Button
            variant="danger"
            confirm={formatMessage(teamMessages.banConfirm)}
            disabled={isPending}
            icon={isPending ? <Spinner tone="current" /> : undefined}
            onClick={ban}
          >
            {formatMessage(teamMessages.banSubmit)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default BanMemberDialog
