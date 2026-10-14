import readIntegrationFailure, { type IntegrationFailure } from '~utils/integration/readIntegrationFailure'

import { ApiError } from '~data/api'

/*
  Why a Connect failed, from the backend's error code alone, as the page a sign-in ends on passes it
  to the window that opened it, or unknown without one
*/
function readIntegrationFailureCode(code: string | null): IntegrationFailure {
  return code === null ? 'unknown' : readIntegrationFailure(new ApiError(0, code, ''))
}

export default readIntegrationFailureCode
