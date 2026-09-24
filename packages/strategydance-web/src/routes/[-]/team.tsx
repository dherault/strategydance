import { createFileRoute } from '@tanstack/react-router'
import { useIntl } from 'react-intl'

import ComingSoon from '~components/layout/ComingSoon'

import navigationMessages from '~data/intl/messages/navigation'

export const Route = createFileRoute('/-/team')({
  component: TeamRoute,
})

function TeamRoute() {
  const { formatMessage } = useIntl()

  return (
    <ComingSoon page={formatMessage(navigationMessages.team)} />
  )
}
