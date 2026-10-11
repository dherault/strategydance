import { getOAuthClient } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import checkClientIdUrl from '~domain/oauth/checkClientIdUrl'
import fetchClientMetadataDocument from '~domain/oauth/fetchClientMetadataDocument'
import isRegisteredClientId from '~domain/oauth/isRegisteredClientId'

// A client as the consent page and the decisions read it
export type OAuthClient = {
  // The registration's id for a registered client, null for a client ID metadata document's
  registeredClientId: string | null
  name: string | null
  redirectUris: string[]
  // A client ID metadata document proves its domain; a registration proves nothing
  isVerified: boolean
  domain: string | null
}

type OAuthClientResult =
  | { outcome: 'found'; client: OAuthClient }
  | { outcome: 'unknown' }
  | { outcome: 'refused'; reason: string }

/*
  The client a `client_id` names: a registered client, read from its registration, unverified, or a
  client ID metadata document's, fetched, verified, its domain the document's. A document is
  fetched only here, which the consent page's routes alone call, once a member has signed in
*/
async function resolveOAuthClient(
  clientId: string,
  fetch?: Parameters<typeof fetchClientMetadataDocument>[1],
): Promise<OAuthClientResult> {
  if (isRegisteredClientId(clientId)) {
    const { data } = await getOAuthClient(dataConnect, { id: clientId })

    if (!data.oAuthClient) return { outcome: 'unknown' }

    return {
      outcome: 'found',
      client: {
        registeredClientId: clientId,
        name: data.oAuthClient.name ?? null,
        redirectUris: data.oAuthClient.redirectUris,
        isVerified: false,
        domain: null,
      },
    }
  }

  if (!checkClientIdUrl(clientId)) return { outcome: 'unknown' }

  const result = await fetchClientMetadataDocument(clientId, fetch)

  if (result.outcome === 'refused') return result

  return {
    outcome: 'found',
    client: {
      registeredClientId: null,
      name: result.document.name,
      redirectUris: result.document.redirectUris,
      isVerified: true,
      domain: new URL(clientId).hostname,
    },
  }
}

export default resolveOAuthClient
