import { type FormEvent, useState } from 'react'
import { useIntl } from 'react-intl'
import { useUpdateAgentConnectionOrganizations } from 'strategydance-database/web/react'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'strategydance-design-system/components/ui/Dialog'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import type { AgentConnection, AgentConnectionMembership } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'

import AgentConnectionOrganizationsField from '~components/agentConnection/AgentConnectionOrganizationsField'
import Spinner from '~components/common/Spinner'

import { dataConnect } from '~data/firebase'
import moduleMessages from '~data/intl/messages/module'

type Props = {
  connection: AgentConnection
  // The reader's, which they choose among, in the order they joined them
  memberships: AgentConnectionMembership[]
  onSaved: () => void
}

/*
  Changes the organizations a connected agent acts in, without the agent: ticked as it reaches them
  now, so one the reader left and rejoined shows unticked until they tick it, and saved as a whole,
  which the agent's next call acts in. The content of the `Dialog` its row's button opens, which
  mounts it only while open, so each opening starts from the connection as it is. Saving keeps the
  dialog open until it goes through, and says so either way
*/
function AgentConnectionOrganizationsDialog({ connection, memberships, onSaved }: Props) {
  const { formatMessage } = useIntl()
  const { data: viewer } = useAuthentication()
  const { mutateAsync: updateOrganizations, isPending } = useUpdateAgentConnectionOrganizations(dataConnect)
  const [chosenIds, setChosenIds] = useState(() => connection.organizations.map(({ id }) => id))

  const agentName = connection.clientName ?? formatMessage(moduleMessages.unnamedAgent)

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!viewer || !chosenIds.length) return

    try {
      await updateOrganizations({ userId: viewer.uid, id: connection.id, organizationIds: chosenIds })

      toast.success(formatMessage(moduleMessages.organizationsSaved, { agentName, count: chosenIds.length }))
      onSaved()
    } catch (error) {
      console.error("Failed to change the agent's organizations", error)

      toast.error(formatMessage(moduleMessages.organizationsSaveError, { agentName }))
    }
  }

  return (
    <DialogContent
      closeLabel={formatMessage(moduleMessages.agentsClose)}
      className="max-h-[calc(100dvh-3rem)] min-w-0 overflow-y-auto sm:max-w-[480px]"
    >
      <form
        onSubmit={save}
        className="flex min-w-0 flex-col gap-6"
      >
        <DialogHeader>
          <DialogTitle>{formatMessage(moduleMessages.editOrganizationsTitle, { agentName })}</DialogTitle>
          <DialogDescription>{formatMessage(moduleMessages.editOrganizationsDescription)}</DialogDescription>
        </DialogHeader>
        <AgentConnectionOrganizationsField
          organizations={memberships.map(({ organization }) => organization)}
          chosenIds={chosenIds}
          onChange={setChosenIds}
          disabled={isPending}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button
              type="button"
              variant="transparent"
              disabled={isPending}
            >
              {formatMessage(moduleMessages.editOrganizationsCancel)}
            </Button>
          </DialogClose>
          <Button
            type="submit"
            disabled={isPending || !chosenIds.length}
            icon={isPending ? <Spinner tone="current" /> : undefined}
          >
            {formatMessage(moduleMessages.editOrganizationsSave)}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

export default AgentConnectionOrganizationsDialog
