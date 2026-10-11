import {
  CLIENT_METADATA_DOCUMENT_FAILURE_LIFETIME_MS,
  CLIENT_METADATA_DOCUMENT_LIFETIME_MS,
  CLIENT_METADATA_DOCUMENT_TIMEOUT_MS,
  MAX_CLIENT_METADATA_DOCUMENT_BYTES,
  MAX_CLIENT_METADATA_DOCUMENTS_KEPT,
  MAX_OAUTH_REDIRECT_URIS,
} from '~constants'

import fetchOutbound from '~utils/fetchOutbound'
import logger from '~utils/logger'

import isValidRedirectUri from '~domain/oauth/isValidRedirectUri'
import sanitizeOAuthClientName from '~domain/oauth/sanitizeOAuthClientName'

// What a client ID metadata document says of its client, as far as the server reads it
export type ClientMetadataDocument = {
  name: string
  redirectUris: string[]
}

type ClientMetadataDocumentResult =
  | { outcome: 'valid'; document: ClientMetadataDocument }
  | { outcome: 'refused'; reason: string }

// The documents read lately, and the failures, each until it lapses, in the order they were read,
// so the oldest goes first once the instance keeps as many as it may
const kept = new Map<string, { expiresAt: number; result: ClientMetadataDocumentResult }>()

function keep(clientId: string, result: ClientMetadataDocumentResult) {
  kept.delete(clientId)

  if (kept.size >= MAX_CLIENT_METADATA_DOCUMENTS_KEPT) kept.delete(kept.keys().next().value ?? '')

  const lifetime =
    result.outcome === 'valid' ? CLIENT_METADATA_DOCUMENT_LIFETIME_MS : CLIENT_METADATA_DOCUMENT_FAILURE_LIFETIME_MS

  kept.set(clientId, { expiresAt: Date.now() + lifetime, result })

  if (result.outcome === 'refused')
    logger.info(`OAuth: the client metadata document ${clientId} was refused: ${result.reason}`)

  return result
}

// What a document says, checked as the specification asks of every client ID metadata document
function readDocument(clientId: string, body: Buffer): ClientMetadataDocumentResult {
  let document: unknown

  try {
    document = JSON.parse(body.toString('utf8'))
  } catch {
    return { outcome: 'refused', reason: 'It is not valid JSON' }
  }

  if (typeof document !== 'object' || document === null || Array.isArray(document)) {
    return { outcome: 'refused', reason: 'It is not a JSON object' }
  }

  const fields = document as Record<string, unknown>
  const name = sanitizeOAuthClientName(fields.client_name)
  const redirectUris = fields.redirect_uris

  if (fields.client_id !== clientId) return { outcome: 'refused', reason: 'Its client_id is not its address' }
  if (!name) return { outcome: 'refused', reason: 'It names no client_name' }
  if (
    !Array.isArray(redirectUris)
    || redirectUris.length < 1
    || redirectUris.length > MAX_OAUTH_REDIRECT_URIS
    || !redirectUris.every(uri => typeof uri === 'string' && isValidRedirectUri(uri))
  ) {
    return { outcome: 'refused', reason: 'Its redirect_uris are missing or not https or loopback addresses' }
  }

  // A document naming no method means `client_secret_basic`, and one may declare `private_key_jwt`:
  // serving either as a public client would drop what it declared
  if (fields.token_endpoint_auth_method !== 'none') {
    return { outcome: 'refused', reason: 'Its token_endpoint_auth_method is not none' }
  }

  return { outcome: 'valid', document: { name, redirectUris } }
}

/*
  A client ID metadata document, the client's own description at the address its `client_id` is,
  fetched only once a member has signed in and the consent page reads the request, so nobody who is
  not signed in can make the server fetch an address of their choosing. Through `fetchOutbound`,
  which reaches public addresses alone, with no redirect, up to 5 KB, a body cut short refused.

  Kept for an hour, and a failure for a minute, in the instance's memory, so a member's Allow reads
  what their consent page read without fetching it again. A fetch that fails, a refused address or
  a timeout, is a refusal like any other
*/
async function fetchClientMetadataDocument(clientId: string, fetch = fetchOutbound) {
  const known = kept.get(clientId)

  if (known && known.expiresAt > Date.now()) return known.result

  try {
    const response = await fetch(clientId, {
      maxBytes: MAX_CLIENT_METADATA_DOCUMENT_BYTES,
      timeoutMs: CLIENT_METADATA_DOCUMENT_TIMEOUT_MS,
      maxRedirects: 0,
      headers: { accept: 'application/json' },
    })

    if (response.status !== 200) return keep(clientId, { outcome: 'refused', reason: `It answered ${response.status}` })
    if (response.isTruncated) return keep(clientId, { outcome: 'refused', reason: 'It is longer than 5 KB' })

    return keep(clientId, readDocument(clientId, response.body))
  } catch (error) {
    return keep(clientId, {
      outcome: 'refused',
      reason: `It could not be fetched: ${error instanceof Error ? error.message : String(error)}`,
    })
  }
}

export default fetchClientMetadataDocument
