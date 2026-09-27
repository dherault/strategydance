import { createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'
import OrganizationProfile from '~components/organizationProfile/OrganizationProfile'
import OrganizationProfileBouncer from '~components/organizationProfile/OrganizationProfileBouncer'

// At module scope so the reference is stable across renders
const ORGANIZATION_PROFILE_MESSAGE_TYPES: MessageType[] = ['organizationProfile']

export const Route = createFileRoute('/-/profile')({
  component: ProfileRoute,
})

/*
  The current organization's profile, for its administrators to edit.

  The page is keyed by the organization, as the team page is, so switching organizations starts
  the form over from the new one's values: unsaved edits to one never carry over to another. The
  bouncer has already turned away a reader with no organization, so the check below only narrows
  the type
*/
function ProfileRoute() {
  const { organization } = useCurrentOrganization()

  return (
    <IntlMessagesRegistration messageTypes={ORGANIZATION_PROFILE_MESSAGE_TYPES}>
      <OrganizationProfileBouncer>
        {organization
          ? (
              <OrganizationProfile
                key={organization.id}
                organization={organization}
              />
            )
          : null}
      </OrganizationProfileBouncer>
    </IntlMessagesRegistration>
  )
}
