import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

/*
  What the current organization's paths lead with, for a link to one of its pages. Read under the
  app's layout, where `UserOrganizationsBouncer` renders nothing for a reader in no organization,
  so there always is one: a component that reads it anywhere else has a bug to say so
*/
function useCurrentOrganizationSlug() {
  const { organizationSlug } = useCurrentOrganization()

  if (!organizationSlug) throw new Error('No current organization to link to')

  return organizationSlug
}

export default useCurrentOrganizationSlug
