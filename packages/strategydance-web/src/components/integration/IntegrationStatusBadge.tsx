import { useIntl } from 'react-intl'
import { Badge } from 'strategydance-design-system/components/ui/Badge'

import type { IntegrationStatus } from '~utils/integration/getIntegrationStatus'

import integrationMessages from '~data/intl/messages/integration'

const STATUS_BADGES = {
  off: { variant: 'neutral', message: integrationMessages.statusOff, hasDot: false },
  connected: { variant: 'success', message: integrationMessages.statusConnected, hasDot: true },
  needsAuthentication: { variant: 'warning', message: integrationMessages.statusNeedsAuthentication, hasDot: true },
  error: { variant: 'danger', message: integrationMessages.statusError, hasDot: true },
} as const

// Where a server stands, as a small badge, as designed: off, connected, waiting for a sign-in, failing
function IntegrationStatusBadge({ status }: { status: IntegrationStatus }) {
  const { formatMessage } = useIntl()
  const { variant, message, hasDot } = STATUS_BADGES[status]

  return (
    <Badge
      size="sm"
      variant={variant}
      dot={hasDot}
    >
      {formatMessage(message)}
    </Badge>
  )
}

export default IntegrationStatusBadge
