import { useIntl } from 'react-intl'

import PageHeader from '~components/layout/PageHeader'

import accountMessages from '~data/intl/messages/account'
import navigationMessages from '~data/intl/messages/navigation'

// The page's title, under a label saying it is the reader's own, and what the page is for
function AccountHeader() {
  const { formatMessage } = useIntl()

  return (
    <PageHeader
      eyebrow={formatMessage(accountMessages.eyebrow)}
      title={formatMessage(navigationMessages.account)}
      lead={formatMessage(accountMessages.lead)}
    />
  )
}

export default AccountHeader
