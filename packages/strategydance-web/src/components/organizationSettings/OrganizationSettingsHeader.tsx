import { useIntl } from 'react-intl'

import navigationMessages from '~data/intl/messages/navigation'
import organizationSettingsMessages from '~data/intl/messages/organizationSettings'

// The page's title, under the sidebar group it sits in, and what the page is for
function OrganizationSettingsHeader() {
  const { formatMessage } = useIntl()

  return (
    <header className="flex flex-col gap-3">
      <p className="m-0 text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {formatMessage(navigationMessages.company)}
      </p>
      <h1 className="m-0 text-5xl leading-[1.05]">
        {formatMessage(navigationMessages.settings)}
      </h1>
      <p className="m-0 text-base leading-[1.6] text-muted-foreground">
        {formatMessage(organizationSettingsMessages.lead)}
      </p>
    </header>
  )
}

export default OrganizationSettingsHeader
