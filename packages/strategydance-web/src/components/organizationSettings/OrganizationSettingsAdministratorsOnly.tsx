import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'

import organizationSettingsMessages from '~data/intl/messages/organizationSettings'

type Props = {
  organizationName: string
}

/*
  What the settings page shows a member who is not an administrator. The sidebar hides the way in
  from them, so this is for somebody arriving by the address, or demoted while on the page
*/
function OrganizationSettingsAdministratorsOnly({ organizationName }: Props) {
  const { formatMessage } = useIntl()

  return (
    <Alert
      variant="info"
      className="max-w-xl"
    >
      {formatMessage(organizationSettingsMessages.administratorsOnly, { organizationName })}
    </Alert>
  )
}

export default OrganizationSettingsAdministratorsOnly
