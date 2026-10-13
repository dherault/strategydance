import type { MessageDescriptor } from 'react-intl'

import type { IntegrationFailure } from '~utils/integration/readIntegrationFailure'

import integrationMessages from '~data/intl/messages/integration'

const FAILURE_MESSAGES: Record<IntegrationFailure, MessageDescriptor> = {
  ADDRESS_REFUSED: integrationMessages.failureAddressRefused,
  UNREACHABLE: integrationMessages.failureUnreachable,
  TIMED_OUT: integrationMessages.failureTimedOut,
  KEY_REFUSED: integrationMessages.failureKeyRefused,
  AUTHENTICATION_REQUIRED: integrationMessages.failureAuthenticationRequired,
  NOT_MCP_SERVER: integrationMessages.failureNotMcpServer,
  DISCOVERY_FAILED: integrationMessages.failureDiscoveryFailed,
  TOO_MANY_TOOLS: integrationMessages.failureTooManyTools,
  full: integrationMessages.failureFull,
  nameTaken: integrationMessages.nameTaken,
  conflict: integrationMessages.failureConflict,
  gone: integrationMessages.failureGone,
  keyUnavailable: integrationMessages.failureKeyUnavailable,
  rateLimited: integrationMessages.failureRateLimited,
  unknown: integrationMessages.failureUnknown,
}

/*
  Why reaching or changing a server failed, as the dialog says it: what a route refused with, or
  the error a server keeps from its last try, which are the same kinds
*/
function getIntegrationFailureMessage(failure: IntegrationFailure) {
  return FAILURE_MESSAGES[failure]
}

export default getIntegrationFailureMessage
