import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'

import organizationSettingsMessages from '~data/intl/messages/organizationSettings'

// What the settings page shows somebody who belongs to no organization, and so has none to set
function OrganizationSettingsNoOrganization() {
  const { formatMessage } = useIntl()

  return (
    <Alert
      variant="info"
      className="max-w-xl"
    >
      {formatMessage(organizationSettingsMessages.noOrganization)}
    </Alert>
  )
}

export default OrganizationSettingsNoOrganization
