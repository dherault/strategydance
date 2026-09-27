import { useIntl } from 'react-intl'

import organizationProfileMessages from '~data/intl/messages/organizationProfile'

// The page's title, under a playful label, and what the page is for
function OrganizationProfileHeader() {
  const { formatMessage } = useIntl()

  return (
    <header className="flex flex-col gap-3">
      <p className="m-0 text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {formatMessage(organizationProfileMessages.eyebrow)}
      </p>
      <h1 className="m-0 text-5xl leading-[1.05]">
        {formatMessage(organizationProfileMessages.title)}
      </h1>
      <p className="m-0 text-base leading-[1.6] text-muted-foreground">
        {formatMessage(organizationProfileMessages.lead)}
      </p>
    </header>
  )
}

export default OrganizationProfileHeader
