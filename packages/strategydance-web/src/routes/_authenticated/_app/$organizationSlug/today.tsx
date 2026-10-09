import { createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'
import Today from '~components/today/Today'
import TodayWait from '~components/today/TodayWait'

// At module scope so the reference is stable across renders
const TODAY_MESSAGE_TYPES: MessageType[] = ['today', 'checklist', 'log']

export const Route = createFileRoute('/_authenticated/_app/$organizationSlug/today')({
  component: TodayRoute,
})

/*
  The waiter and the page are keyed by the organization, so switching organizations mounts both
  anew: a dialog open on one organization's priorities, a checklist column being renamed or a draft
  log entry must not survive into another
*/
function TodayRoute() {
  const { organization } = useCurrentOrganization()

  return (
    <IntlMessagesRegistration messageTypes={TODAY_MESSAGE_TYPES}>
      <TodayWait key={organization?.id ?? 'none'}>
        <Today />
      </TodayWait>
    </IntlMessagesRegistration>
  )
}
