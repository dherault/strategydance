import { Outlet, createFileRoute, notFound } from '@tanstack/react-router'

import isOrganizationPathSegment from '~utils/organization/isOrganizationPathSegment'

import CurrentOrganizationBouncer from '~components/organization/CurrentOrganizationBouncer'

/*
  Every page of one organization, under the segment its paths lead with: its slug, as in
  `/strategy-dance-ad34/today`, or its id while it has none. `_CurrentOrganizationProvider` reads
  the segment to say which organization is current, and the bouncer shows the organization not
  found page when the reader is in none it names.

  A dynamic segment at the root, which a static route outranks without a word: a slug always ends
  in a dash and four characters, so no page of the app's can take one, and `routeTree.test.ts`
  fails when one could. A segment that cannot name an organization at all is the app's not found
  page, before anything asks the reader to sign in
*/
export const Route = createFileRoute('/_authenticated/_app/$organizationSlug')({
  beforeLoad: ({ params }) => {
    if (!isOrganizationPathSegment(params.organizationSlug)) throw notFound()
  },
  component: OrganizationRoute,
})

function OrganizationRoute() {
  return (
    <CurrentOrganizationBouncer>
      <Outlet />
    </CurrentOrganizationBouncer>
  )
}
