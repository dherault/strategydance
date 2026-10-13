import { GITHUB_REPOSITORY, SECRET_GITHUB_APP_ID, SECRET_GITHUB_APP_PRIVATE_KEY } from '~constants'

import retrieveSecret from '~utils/retrieveSecret'

import createGitHubAppJwt from '~domain/github/createGitHubAppJwt'
import createGitHubClient from '~domain/github/createGitHubClient'

/*
  A token of the GitHub App installed on the repository, good for an hour and for this repository
  alone. The App's id and private key are `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` when set, as on
  a machine whose credentials cannot read Secret Manager, and its secrets otherwise
*/
async function createGitHubAppToken() {
  const [appId, privateKey] = await Promise.all([
    process.env.GITHUB_APP_ID || retrieveSecret(SECRET_GITHUB_APP_ID),
    process.env.GITHUB_APP_PRIVATE_KEY || retrieveSecret(SECRET_GITHUB_APP_PRIVATE_KEY),
  ])
  const app = createGitHubClient(createGitHubAppJwt(appId.trim(), privateKey))
  const { data: installation } = await app.request('GET', `/repos/${GITHUB_REPOSITORY}/installation`)
  const { data } = await app.request(
    'POST',
    `/app/installations/${(installation as { id: number }).id}/access_tokens`,
    {
      body: { repositories: [GITHUB_REPOSITORY.split('/')[1]] },
    },
  )

  return (data as { token: string }).token
}

export default createGitHubAppToken
