import { createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'
import Team from '~components/team/Team'
import TeamWait from '~components/team/TeamWait'

// At module scope so the reference is stable across renders
const TEAM_MESSAGE_TYPES: MessageType[] = ['team']

export const Route = createFileRoute('/-/team')({
  component: TeamRoute,
})

function TeamRoute() {
  return (
    <IntlMessagesRegistration messageTypes={TEAM_MESSAGE_TYPES}>
      <TeamWait>
        <Team />
      </TeamWait>
    </IntlMessagesRegistration>
  )
}
