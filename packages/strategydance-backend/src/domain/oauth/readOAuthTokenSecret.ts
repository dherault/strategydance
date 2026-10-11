import { DEVELOPMENT_OAUTH_TOKEN_SECRET, IS_PRODUCTION, SECRET_OAUTH_TOKEN_SECRET } from '~constants'

import retrieveSecretVersion from '~utils/retrieveSecretVersion'

/*
  What a refresh token's successors are derived under, with its version: `oauth-token-secret` in
  production, its latest version unless a number says which, and a fixed value as version 1
  anywhere else, so developing and testing read no secret
*/
async function readOAuthTokenSecret(version?: number) {
  if (!IS_PRODUCTION) return { value: DEVELOPMENT_OAUTH_TOKEN_SECRET, version: 1 }

  return retrieveSecretVersion(SECRET_OAUTH_TOKEN_SECRET, version)
}

export default readOAuthTokenSecret
