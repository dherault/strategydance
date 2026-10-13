import {
  ERROR_CODE_CONFLICT,
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
}

/*
  Why an integration route refused, as the dialog words it: the way reaching the server failed, one
  of the database's `IntegrationError`s as `lastError` holds them too, or what else the route
  answered. Anything else, a lost connection included, is unknown
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
  | 'unknown'

export { type IntegrationFailure }

export default readIntegrationFailure
