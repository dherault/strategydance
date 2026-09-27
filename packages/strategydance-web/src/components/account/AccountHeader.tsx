import { useIntl } from 'react-intl'

import accountMessages from '~data/intl/messages/account'
import navigationMessages from '~data/intl/messages/navigation'

// The page's title, under a label saying it is the reader's own, and what the page is for
function AccountHeader() {
  const { formatMessage } = useIntl()

  return (
    <header className="flex flex-col gap-3">
      <p className="m-0 text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {formatMessage(accountMessages.eyebrow)}
      </p>
      <h1 className="m-0 text-5xl leading-[1.05]">
        {formatMessage(navigationMessages.account)}
      </h1>
      <p className="m-0 text-base leading-[1.6] text-muted-foreground">
        {formatMessage(accountMessages.lead)}
      </p>
    </header>
  )
}

export default AccountHeader
