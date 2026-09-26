import { createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'
import OrganizationSettings from '~components/organizationSettings/OrganizationSettings'
import OrganizationSettingsBouncer from '~components/organizationSettings/OrganizationSettingsBouncer'

// At module scope so the reference is stable across renders
const ORGANIZATION_SETTINGS_MESSAGE_TYPES: MessageType[] = ['organizationSettings']

export const Route = createFileRoute('/-/settings')({
  component: SettingsRoute,
})

/*
  The current organization's settings, for its administrators.

  The page is keyed by the organization, as the team page is, so switching organizations starts
  the form over from the new one's values: unsaved edits to one never carry over to another. The
  bouncer has already turned away a reader with no organization, so the check below only narrows
  the type
*/
function SettingsRoute() {
  const { organization } = useCurrentOrganization()

  return (
    <IntlMessagesRegistration messageTypes={ORGANIZATION_SETTINGS_MESSAGE_TYPES}>
      <OrganizationSettingsBouncer>
        {organization
          ? (
              <OrganizationSettings
                key={organization.id}
                organization={organization}
              />
            )
          : null}
      </OrganizationSettingsBouncer>
    </IntlMessagesRegistration>
  )
}
