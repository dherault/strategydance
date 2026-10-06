import { createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import BuildInPublic from '~components/buildInPublic/BuildInPublic'
import BuildInPublicWait from '~components/buildInPublic/BuildInPublicWait'
import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'

// At module scope so the reference is stable across renders
const BUILD_IN_PUBLIC_MESSAGE_TYPES: MessageType[] = ['buildInPublic']

export const Route = createFileRoute('/_authenticated/_app/$organizationSlug/build-in-public')({
  component: BuildInPublicRoute,
})

/*
  The waiter and the page are keyed by the organization, so switching organizations mounts both
  anew: the waiter waits on the new organization's reads, and the page reads the settings the
  reader kept for it
*/
function BuildInPublicRoute() {
  const { organization } = useCurrentOrganization()

  return (
    <IntlMessagesRegistration messageTypes={BUILD_IN_PUBLIC_MESSAGE_TYPES}>
      <BuildInPublicWait key={organization?.id ?? 'none'}>
        <BuildInPublic />
      </BuildInPublicWait>
    </IntlMessagesRegistration>
  )
}
