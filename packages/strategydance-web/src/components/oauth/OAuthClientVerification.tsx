import { useIntl } from 'react-intl'
import { Badge } from 'strategydance-design-system/components/ui/Badge'

import moduleMessages from '~data/intl/messages/module'

type Props = {
  // The domain of the client's metadata document, which vouches for its name, or null for a client
  // that registered itself, which nothing vouches for
  domain: string | null
  className?: string
}

// What vouches for an external agent's name, beside it: its metadata document's domain, or nothing
function OAuthClientVerification({ domain, className }: Props) {
  const { formatMessage } = useIntl()

  if (domain) {
    return <span className={className}>{formatMessage(moduleMessages.agentDomain, { domain })}</span>
  }

  return (
    <Badge
      variant="warning"
      title={formatMessage(moduleMessages.unverifiedHint)}
      className={className}
    >
      {formatMessage(moduleMessages.unverified)}
    </Badge>
  )
}

export default OAuthClientVerification
