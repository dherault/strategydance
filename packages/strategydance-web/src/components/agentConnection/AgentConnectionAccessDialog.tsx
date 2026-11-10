import { type FormEvent, useState } from 'react'
import { useIntl } from 'react-intl'
import type { ModuleName } from 'strategydance-core'
import { useUpdateAgentConnectionScopes } from 'strategydance-database/web/react'
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

import type { AgentConnection } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'

import type { OAuthConsentAccessLevel } from '~utils/oauth/readOAuthConsentModules'
import toOAuthConsentScopes from '~utils/oauth/toOAuthConsentScopes'

import Spinner from '~components/common/Spinner'
import OAuthConsentAccess from '~components/oauth/OAuthConsentAccess'

import { dataConnect } from '~data/firebase'
import moduleMessages from '~data/intl/messages/module'

type Props = {
  connection: AgentConnection
  // Each module the connection holds at the one address, in `MODULES`' order
  modules: { name: ModuleName; isWrite: boolean }[]
  onSaved: () => void
}

/*
  Narrows what an agent connected at the one address may do in each module, without the agent: each
  module it holds starts as it holds it, and may go down to read, or, beside another, to not
  allowed, never up, since only a consent grants, through the agent's own request. At least one
  module stays allowed, as on the consent page, and the agent's next call and next refresh keep to
  what is saved. The content of the `Dialog` its row's button opens, which mounts it only while
  open, so each opening starts from the connection as it is. What the member chose is kept apart
  from what the connection holds, and never above it, so a narrowing saved meanwhile in another tab,
  which the live list brings in, lowers the choice rather than leave one Save would be refused.
  Saving keeps the dialog open until it goes through, and says so either way
*/
function AgentConnectionAccessDialog({ connection, modules, onSaved }: Props) {
  const { formatMessage } = useIntl()
  const { data: viewer } = useAuthentication()
  const { mutateAsync: updateScopes, isPending } = useUpdateAgentConnectionScopes(dataConnect)
  const [chosen, setChosen] = useState<Partial<Record<ModuleName, OAuthConsentAccessLevel>>>({})

  const agentName = connection.clientName ?? formatMessage(moduleMessages.unnamedAgent)
  const held: Partial<Record<ModuleName, OAuthConsentAccessLevel>> = Object.fromEntries(
    modules.map(({ name, isWrite }) => [name, isWrite ? 'write' : 'read']),
  )
  // Each module as chosen, or as held, and read at most once its write is held no more
  const accesses: Partial<Record<ModuleName, OAuthConsentAccessLevel>> = Object.fromEntries(
    modules.map(({ name, isWrite }) => {
      const access = chosen[name] ?? held[name]

      return [name, access === 'write' && !isWrite ? 'read' : access]
    }),
  )
  const scopes = toOAuthConsentScopes(accesses)
  const isChanged = scopes.join(' ') !== toOAuthConsentScopes(held).join(' ')

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!viewer || !scopes.length || !isChanged) return

    try {
      await updateScopes({ userId: viewer.uid, id: connection.id, scopes })

      toast.success(formatMessage(moduleMessages.accessSaved, { agentName }))
      onSaved()
    } catch (error) {
      console.error("Failed to narrow the agent's access", error)

      toast.error(formatMessage(moduleMessages.accessSaveError, { agentName }))
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
          <DialogTitle>{formatMessage(moduleMessages.editAccessTitle, { agentName })}</DialogTitle>
          <DialogDescription>{formatMessage(moduleMessages.editAccessDescription)}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          {scopes.length ? null : (
            <p
              aria-live="polite"
              className="m-0 text-xs text-danger"
            >
              {formatMessage(moduleMessages.modulesRequired)}
            </p>
          )}
          {modules.map(({ name, isWrite }) => (
            <OAuthConsentAccess
              key={name}
              module={name}
              access={accesses[name] ?? 'none'}
              isWriteOffered={isWrite}
              isNoneOffered={modules.length > 1}
              isNamed
              onChange={access => setChosen(previous => ({ ...previous, [name]: access }))}
              disabled={isPending}
            />
          ))}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button
              type="button"
              variant="transparent"
              disabled={isPending}
            >
              {formatMessage(moduleMessages.editAccessCancel)}
            </Button>
          </DialogClose>
          <Button
            type="submit"
            disabled={isPending || !scopes.length || !isChanged}
            icon={isPending ? <Spinner tone="current" /> : undefined}
          >
            {formatMessage(moduleMessages.editAccessSave)}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

export default AgentConnectionAccessDialog
