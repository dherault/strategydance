import { useIntl } from 'react-intl'

import PageHeader from '~components/layout/PageHeader'

import organizationProfileMessages from '~data/intl/messages/organizationProfile'

// The page's title, under a playful label, and what the page is for
function OrganizationProfileHeader() {
  const { formatMessage } = useIntl()

  return (
    <PageHeader
      eyebrow={formatMessage(organizationProfileMessages.eyebrow)}
      title={formatMessage(organizationProfileMessages.title)}
      lead={formatMessage(organizationProfileMessages.lead)}
    />
  )
}

export default OrganizationProfileHeader
