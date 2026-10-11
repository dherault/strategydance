import retrieveSecretVersion from '~utils/retrieveSecretVersion'

/*
  A secret's value, from Secret Manager in the project the backend runs in: its latest version
  unless a number says which, cached for the life of the process as `retrieveSecretVersion` keeps
  it. Throws when the secret is missing or empty, so a misconfigured deploy fails where the secret
  is needed rather than sending an empty key along
*/
async function retrieveSecret(name: string, version?: number) {
  const { value } = await retrieveSecretVersion(name, version)

  return value
}

export default retrieveSecret
