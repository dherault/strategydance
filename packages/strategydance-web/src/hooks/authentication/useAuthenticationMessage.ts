import { useCallback } from 'react'
import { useIntl } from 'react-intl'

import { DEFAULT_AUTHENTICATION_ERROR, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '~constants'

import authenticationMessages from '~data/intl/messages/authentication'

/*
  Formats one of `~data/intl/messages/authentication` by key.

  Both callers hold a key rather than a message: zod carries validation keys through
  `fieldState.error.message`, and `AUTHENTICATION_ERRORS` maps Firebase's codes onto the same
  set. A key rather than a message id, because `formatMessage` needs the whole descriptor: the
  source locale ships no catalogue, and an id on its own would resolve to nothing.

  The password lengths are passed to every message. Formatting a value a message does not use
  costs nothing, and the alternative is each call site knowing which ones take them
*/
function useAuthenticationMessage() {
  const { formatMessage } = useIntl()

  return useCallback((key: string) => {
    const descriptor = authenticationMessages[key as keyof typeof authenticationMessages]
      ?? authenticationMessages[DEFAULT_AUTHENTICATION_ERROR as keyof typeof authenticationMessages]

    return formatMessage(descriptor, {
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
    })
  }, [
    formatMessage,
  ])
}

export default useAuthenticationMessage
