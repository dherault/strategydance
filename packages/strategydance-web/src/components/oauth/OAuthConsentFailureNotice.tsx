import { useIntl } from 'react-intl'

import type { OAuthConsentFailure } from '~utils/oauth/getOAuthConsentFailure'

import OAuthConsentNotice from '~components/oauth/OAuthConsentNotice'

import moduleMessages from '~data/intl/messages/module'

type Props = {
  failure: OAuthConsentFailure
}

const FAILURE_MESSAGES = {
  expired: { title: moduleMessages.expiredTitle, description: moduleMessages.expiredDescription },
  refused: { title: moduleMessages.refusedTitle, description: moduleMessages.refusedDescription },
  unavailable: { title: moduleMessages.unavailableTitle, description: moduleMessages.unavailableDescription },
} as const satisfies Record<OAuthConsentFailure, unknown>

// Why the consent page has no request to answer, whether its read or the member's answer found out
function OAuthConsentFailureNotice({ failure }: Props) {
  const { formatMessage } = useIntl()
  const { title, description } = FAILURE_MESSAGES[failure]

  return (
    <OAuthConsentNotice
      title={formatMessage(title)}
      description={formatMessage(description)}
    />
  )
}

export default OAuthConsentFailureNotice
