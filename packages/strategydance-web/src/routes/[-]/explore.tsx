import { createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import ExploreAspects from '~components/company/ExploreAspects'
import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'

// At module scope so the reference is stable across renders
const EXPLORE_MESSAGE_TYPES: MessageType[] = ['explore']

export const Route = createFileRoute('/-/explore')({
  component: ExploreRoute,
})

function ExploreRoute() {
  return (
    <IntlMessagesRegistration messageTypes={EXPLORE_MESSAGE_TYPES}>
      <ExploreAspects />
    </IntlMessagesRegistration>
  )
}
