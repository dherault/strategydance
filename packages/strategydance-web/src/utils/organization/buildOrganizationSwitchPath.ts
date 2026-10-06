// The sections whose pages below the list belong to one organization: a document, a conversation
const SECTIONS_OF_ONE_ORGANIZATION = ['knowledge', 'conversations']

/*
  Where switching to another organization leads from an organization's page: the same page in the
  other one, so the reader stays on the team page or on an aspect, but a document's or a
  conversation's list in place of one of them, which belongs to the organization being left
*/
function buildOrganizationSwitchPath(pathname: string, organizationSlug: string) {
  const [, , section, ...rest] = pathname.split('/')

  if (!section) return `/${organizationSlug}/today`
  if (SECTIONS_OF_ONE_ORGANIZATION.includes(section)) return `/${organizationSlug}/${section}`

  return ['', organizationSlug, section, ...rest].join('/')
}

export default buildOrganizationSwitchPath
