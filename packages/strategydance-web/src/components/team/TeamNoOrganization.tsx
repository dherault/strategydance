import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'

import teamMessages from '~data/intl/messages/team'

// What the team page shows somebody who belongs to no organization, and so has no team yet
function TeamNoOrganization() {
  const { formatMessage } = useIntl()

  return (
    <Alert
      variant="info"
      className="max-w-xl"
    >
      {formatMessage(teamMessages.noOrganization)}
    </Alert>
  )
}

export default TeamNoOrganization
