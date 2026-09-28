import { createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'
import Today from '~components/today/Today'
import TodayWait from '~components/today/TodayWait'

// At module scope so the reference is stable across renders
const TODAY_MESSAGE_TYPES: MessageType[] = ['today', 'task', 'checklist', 'log']

export const Route = createFileRoute('/_authenticated/_app/today')({
  component: TodayRoute,
})

/*
  The page is keyed by the organization, so switching organizations mounts it anew: a dialog
  open on one organization's priorities, a task being edited or a draft log entry must not
  survive into another
*/
function TodayRoute() {
  const { organization } = useCurrentOrganization()

  return (
    <IntlMessagesRegistration messageTypes={TODAY_MESSAGE_TYPES}>
      <TodayWait>
        <Today key={organization?.id ?? 'none'} />
      </TodayWait>
    </IntlMessagesRegistration>
  )
}
