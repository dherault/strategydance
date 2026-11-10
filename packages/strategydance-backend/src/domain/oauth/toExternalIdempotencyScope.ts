import hashOAuthToken from '~domain/oauth/hashOAuthToken'

/*
  An external agent's idempotency scope at the one address, from what a consent keeps rather than
  its connection's id, which every consent changes, since Allow replaces the connection: the
  member's account, the client and the address. A write whose answer was lost while the member
  consented again is then found under its key rather than applied twice. A JSON array, so two
  triples never write the same text, since a client's id is a free-form address, hashed as the
  tokens are kept, SHA-256 in base64url. `external:` says what the code calls such a caller, where
  `conversation:` names Strategy Dance's agent's
*/
function toExternalIdempotencyScope(userId: string, clientId: string, addressName: string) {
  return `external:${hashOAuthToken(JSON.stringify([userId, clientId, addressName]))}`
}

export default toExternalIdempotencyScope
