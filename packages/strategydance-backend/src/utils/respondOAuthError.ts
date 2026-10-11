import type { Response } from 'express'

/*
  An OAuth endpoint's refusal, in OAuth's own JSON (RFC 6749, 5.2) rather than the app's envelope,
  since the protocol's clients read nothing else: the error code, and a sentence a developer can act
  on. It never logs, as `respondError` does not
*/
function respondOAuthError(response: Response, status: number, error: string, description: string) {
  response.status(status).json({ error, error_description: description })
}

export default respondOAuthError
