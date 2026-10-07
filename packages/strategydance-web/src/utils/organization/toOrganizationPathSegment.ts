/*
  What an organization's paths lead with: its slug, or its id when it has none, as one a page from
  before slugs created has not. Paths are built from this, and read back by
  `_CurrentOrganizationProvider`, which matches either
*/
function toOrganizationPathSegment(organization: { id: string; slug?: string | null }) {
  return organization.slug ?? organization.id
}

export default toOrganizationPathSegment
