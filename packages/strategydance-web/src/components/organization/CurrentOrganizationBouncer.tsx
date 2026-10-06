import { useNavigate, useParams } from '@tanstack/react-router'
import { type PropsWithChildren, useEffect, useState } from 'react'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

import OrganizationNotFound from '~components/organization/OrganizationNotFound'

/*
  Keeps an organization's pages to an organization the reader is in. Sits under
  `UserOrganizationsWait`, so the list it judges the path against has arrived.

  A path naming none of it is the organization not found page, whether the organization was
  deleted, the reader was never invited or the slug was mistyped. One that named an organization
  while its page was open, and names none since, saw it go: deleted, here or elsewhere, or the
  reader removed. The team's live query, kept open here, is what tells the app, and the reader
  moves on to the today of the organization the sidebar falls back to, as somebody deleting it
  from its profile page does, rather than read that it was never there.

  Effects on the verdict rather than a `<Navigate>`, as `AuthenticationBouncer` explains
*/
function CurrentOrganizationBouncer({ children }: PropsWithChildren) {
  const { organizationSlug: routeOrganizationSlug } = useParams({ from: '/_authenticated/_app/$organizationSlug' })
  const { organization, organizationSlug, isRouteOrganizationMissing } = useCurrentOrganization()
  const navigate = useNavigate()

  /*
    The path whose organization this page last showed, kept up during render as React has a value
    that follows another kept: an effect would leave a render between, judging the path by the one
    before it
  */
  const [openedSlug, setOpenedSlug] = useState<string | null>(null)

  if (!isRouteOrganizationMissing && openedSlug !== routeOrganizationSlug) setOpenedSlug(routeOrganizationSlug)

  useOrganizationTeam()

  const isGone = isRouteOrganizationMissing && openedSlug === routeOrganizationSlug

  useEffect(() => {
    if (isGone && organizationSlug)
      navigate({ to: '/$organizationSlug/today', params: { organizationSlug }, replace: true })
  }, [isGone, organizationSlug, navigate])

  if (isGone) return null

  if (isRouteOrganizationMissing) {
    return (
      <OrganizationNotFound
        fallback={
          organization && organizationSlug
            ? {
                organizationName: organization.name,
                link: { to: '/$organizationSlug/today', params: { organizationSlug } },
              }
            : null
        }
      />
    )
  }

  return children
}

export default CurrentOrganizationBouncer
