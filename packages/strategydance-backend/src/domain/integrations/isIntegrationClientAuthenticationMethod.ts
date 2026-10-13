// How a token endpoint takes Strategy Dance's client, of the methods it can use: as a public client,
// or with the secret a registration gave, in the form or in a Basic header
type IntegrationClientAuthenticationMethod = 'none' | 'client_secret_post' | 'client_secret_basic'

const AUTHENTICATION_METHODS: readonly string[] = ['none', 'client_secret_post', 'client_secret_basic']

function isIntegrationClientAuthenticationMethod(method: string): method is IntegrationClientAuthenticationMethod {
  return AUTHENTICATION_METHODS.includes(method)
}

export { type IntegrationClientAuthenticationMethod }

export default isIntegrationClientAuthenticationMethod
