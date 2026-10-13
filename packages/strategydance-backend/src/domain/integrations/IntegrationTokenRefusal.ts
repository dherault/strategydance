/*
  An authorization server's refusal of a token request, or an answer Strategy Dance cannot use, set
  apart from a server it could not reach: the grant is no longer good (`invalidGrant`), a code spent
  or a refresh token revoked, which only connecting again mends; the client is no longer taken
  (`invalidClient`), which registering again mends; or anything else (`refused`), which another try
  may mend. Its message names the server's origin and the error's code alone, never what the server
  wrote, which could hold anything
*/
class IntegrationTokenRefusal extends Error {
  name = 'IntegrationTokenRefusal'

  constructor(
    readonly reason: 'invalidGrant' | 'invalidClient' | 'refused',
    message: string,
  ) {
    super(message)
  }
}

export default IntegrationTokenRefusal
