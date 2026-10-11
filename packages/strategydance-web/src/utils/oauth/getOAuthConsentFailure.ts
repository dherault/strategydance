import { ERROR_CODE_FORBIDDEN, ERROR_CODE_NOT_FOUND, ERROR_CODE_OAUTH_CLIENT_REFUSED } from 'strategydance-core'

import { ApiError } from '~data/api'

export type OAuthConsentFailure = 'expired' | 'refused' | 'unavailable'

/*
  What a refusal of the consent page's routes means for the member, or null when it says nothing
  they can act on but trying again:

  - expired: the request is unknown, decided already or past its ten minutes
  - refused: the client's metadata document could not be fetched, or does not declare the address
    the request asks to send the member back to
  - unavailable: the reader may not connect agents yet. Allow also answers it for an organization
    the reader is not in, which the page only offers among their own
*/
function getOAuthConsentFailure(error: unknown): OAuthConsentFailure | null {
  if (!(error instanceof ApiError)) return null
  if (error.code === ERROR_CODE_NOT_FOUND) return 'expired'
  if (error.code === ERROR_CODE_OAUTH_CLIENT_REFUSED) return 'refused'
  if (error.code === ERROR_CODE_FORBIDDEN) return 'unavailable'

  return null
}

export default getOAuthConsentFailure
