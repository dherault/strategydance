import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'

import organizationProfileMessages from '~data/intl/messages/organizationProfile'

// What the profile page shows somebody who belongs to no organization, and so has none to edit
function OrganizationProfileNoOrganization() {
  const { formatMessage } = useIntl()

  return (
    <Alert
      variant="info"
      className="max-w-xl"
    >
      {formatMessage(organizationProfileMessages.noOrganization)}
    </Alert>
  )
}

export default OrganizationProfileNoOrganization
