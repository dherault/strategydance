import { createFileRoute } from '@tanstack/react-router'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import Today from '~components/today/Today'
import TodayWait from '~components/today/TodayWait'

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
    <TodayWait>
      <Today key={organization?.id ?? 'none'} />
    </TodayWait>
  )
}
