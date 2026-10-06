/*
  What an organization's paths lead with: its slug, or its id while it has none, as an
  organization made before slugs has until the backfill gives it one. Paths are built from this,
  and read back by `_CurrentOrganizationProvider`, which matches either
*/
function toOrganizationPathSegment(organization: { id: string; slug?: string | null }) {
  return organization.slug ?? organization.id
}

export default toOrganizationPathSegment
