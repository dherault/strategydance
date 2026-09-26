import { createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'
import Team from '~components/team/Team'
import TeamWait from '~components/team/TeamWait'

// At module scope so the reference is stable across renders
const TEAM_MESSAGE_TYPES: MessageType[] = ['team']

export const Route = createFileRoute('/-/team')({
  component: TeamRoute,
})

/*
  The page is keyed by the organization, so switching organizations mounts it anew. An open
  dialog holds a member of the organization it was opened in, and must not survive into another,
  where the same person could be a member too: switched from the sidebar, or moved on after the
  reader was removed, the page starts over with nothing open
*/
function TeamRoute() {
  const { organization } = useCurrentOrganization()

  return (
    <IntlMessagesRegistration messageTypes={TEAM_MESSAGE_TYPES}>
      <TeamWait>
        <Team key={organization?.id ?? 'none'} />
      </TeamWait>
    </IntlMessagesRegistration>
  )
}
