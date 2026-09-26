import { type FormEvent, useState } from 'react'
import { useIntl } from 'react-intl'
import { MAX_ORGANIZATION_NAME_LENGTH } from 'strategydance-core'
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

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'
import useUserOrganizations from '~hooks/userOrganization/useUserOrganizations'

import Spinner from '~components/common/Spinner'

import navigationMessages from '~data/intl/messages/navigation'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Creates an organization and switches to it
function AddOrganizationDialog({ open, onOpenChange }: Props) {
  const { formatMessage } = useIntl()
  const { createOrganization } = useUserOrganizations()
  const { setOrganizationId } = useCurrentOrganization()

  const [name, setName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [hasFailed, setHasFailed] = useState(false)

  const trimmedName = name.trim()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!trimmedName || isCreating) return

    setIsCreating(true)
    setHasFailed(false)

    try {
      /*
        Creating and choosing are two concerns and two providers, so this is what joins them. The
        id is safe to choose the moment it arrives: the create refetched before answering, so the
        list already holds the row it names
      */
      const organizationId = await createOrganization(trimmedName)

      setOrganizationId(organizationId)
      setName('')
      onOpenChange(false)
    }
    catch (error) {
      console.error('Failed to create the organization', error)

      // What was typed stays where it was typed
      setHasFailed(true)
    }
    finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent closeLabel={formatMessage(navigationMessages.close)}>
        <form
          onSubmit={handleSubmit}
          className="grid gap-6"
        >
          <DialogHeader>
            <DialogTitle>
              {formatMessage(navigationMessages.addOrganizationTitle)}
            </DialogTitle>
            <DialogDescription>
              {formatMessage(navigationMessages.addOrganizationDescription)}
            </DialogDescription>
          </DialogHeader>
          <Input
            label={formatMessage(navigationMessages.organizationName)}
            value={name}
            onChange={event => setName(event.target.value)}
            error={hasFailed ? formatMessage(navigationMessages.addOrganizationError) : undefined}
            maxLength={MAX_ORGANIZATION_NAME_LENGTH}
            autoComplete="organization"
            autoFocus
          />
          <DialogFooter>
            <Button
              type="submit"
              disabled={isCreating || !trimmedName}
              icon={isCreating ? <Spinner tone="current" /> : undefined}
            >
              {formatMessage(navigationMessages.addOrganizationSubmit)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default AddOrganizationDialog
