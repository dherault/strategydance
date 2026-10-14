import {
  ERROR_CODE_CONFLICT,
  ERROR_CODE_INTEGRATION_AUTHORIZATION_EXPIRED,
  ERROR_CODE_INTEGRATION_AUTHORIZATION_NOT_YOURS,
  ERROR_CODE_INTEGRATION_CONNECTION_EXPIRED,
  ERROR_CODE_INTEGRATION_CONNECTION_REFUSED,
  ERROR_CODE_INTEGRATION_ISSUER_CHANGED,
  ERROR_CODE_INTEGRATION_NAME_TAKEN,
  ERROR_CODE_NOT_FOUND,
  ERROR_CODE_SERVICE_UNAVAILABLE,
  ERROR_CODE_TOO_MANY_INTEGRATIONS,
  ERROR_CODE_TOO_MANY_REQUESTS,
  INTEGRATION_FAILURE_ERROR_CODES,
} from 'strategydance-core'
import type { IntegrationError } from 'strategydance-database/web'

import { ApiError } from '~data/api'

const OTHER_FAILURES: Record<string, IntegrationFailure> = {
  [ERROR_CODE_TOO_MANY_INTEGRATIONS]: 'full',
  [ERROR_CODE_INTEGRATION_NAME_TAKEN]: 'nameTaken',
  [ERROR_CODE_CONFLICT]: 'conflict',
  [ERROR_CODE_NOT_FOUND]: 'gone',
  [ERROR_CODE_SERVICE_UNAVAILABLE]: 'keyUnavailable',
  [ERROR_CODE_TOO_MANY_REQUESTS]: 'rateLimited',
  [ERROR_CODE_INTEGRATION_ISSUER_CHANGED]: 'issuerChanged',
  [ERROR_CODE_INTEGRATION_AUTHORIZATION_EXPIRED]: 'authorizationExpired',
  [ERROR_CODE_INTEGRATION_AUTHORIZATION_NOT_YOURS]: 'authorizationNotYours',
  [ERROR_CODE_INTEGRATION_CONNECTION_REFUSED]: 'connectionRefused',
  [ERROR_CODE_INTEGRATION_CONNECTION_EXPIRED]: 'connectionExpired',
}

/*
  Why an integration route refused, as the dialog words it: the way reaching the server failed, one
  of the database's `IntegrationError`s as `lastError` holds them too, or what else the route
  answered, a member's Connect's refusals included. Anything else, a lost connection included, is
  unknown
*/
function readIntegrationFailure(error: unknown): IntegrationFailure {
  if (!(error instanceof ApiError)) return 'unknown'

  const kind = Object.entries(INTEGRATION_FAILURE_ERROR_CODES).find(([, code]) => code === error.code)?.[0]

  if (kind) return kind as IntegrationError

  return OTHER_FAILURES[error.code] ?? 'unknown'
}

type IntegrationFailure =
  | IntegrationError
  | 'full'
  | 'nameTaken'
  | 'conflict'
  | 'gone'
  | 'keyUnavailable'
  | 'rateLimited'
  | 'issuerChanged'
  | 'authorizationExpired'
  | 'authorizationNotYours'
  | 'connectionRefused'
  | 'connectionExpired'
  | 'unknown'

export { type IntegrationFailure }

export default readIntegrationFailure
