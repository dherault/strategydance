import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'

import organizationProfileMessages from '~data/intl/messages/organizationProfile'

type Props = {
  organizationName: string
}

/*
  What the profile page shows a member who is not an administrator. The sidebar hides the way in
  from them, so this is for somebody arriving by the address, or demoted while on the page
*/
function OrganizationProfileAdministratorsOnly({ organizationName }: Props) {
  const { formatMessage } = useIntl()

  return (
    <Alert
      variant="info"
      className="max-w-xl"
    >
      {formatMessage(organizationProfileMessages.administratorsOnly, { organizationName })}
    </Alert>
  )
}

export default OrganizationProfileAdministratorsOnly
