import { isOrganizationSlug } from 'strategydance-core'

// An organization's id as Data Connect writes it back: 32 hex digits, no dashes
const ORGANIZATION_ID_PATTERN = /^[0-9a-f]{32}$/

/*
  Whether a path's first segment can name an organization at all: a slug, or an id, which
  addresses an organization that has no slug yet. Anything else is a page that does not exist,
  which a mistyped `/legl` should stay, rather than an organization to sign in and look for
*/
function isOrganizationPathSegment(value: string) {
  return isOrganizationSlug(value) || ORGANIZATION_ID_PATTERN.test(value)
}

export default isOrganizationPathSegment
