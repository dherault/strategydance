import { createFileRoute } from '@tanstack/react-router'

import CurrentOrganizationRedirect from '~components/organization/CurrentOrganizationRedirect'

/*
  Where the app lands without an organization named: after signing in, joining or onboarding, from
  the support page, and from links that predate organizations' paths. It goes on to the today of
  the organization the reader last had open, or their first
*/
export const Route = createFileRoute('/_authenticated/_app/today')({
  component: CurrentOrganizationRedirect,
})
