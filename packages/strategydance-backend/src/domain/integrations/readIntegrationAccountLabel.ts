import { MAX_INTEGRATION_ACCOUNT_LABEL_LENGTH } from 'strategydance-core'

// The claims an ID token names its account by, the most telling first
const LABEL_CLAIMS = ['email', 'preferred_username', 'name']

// Control and format characters, the direction marks among them, and line and paragraph separators
const HIDDEN_CHARACTERS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu

/*
  Who a member signed in to an OAuth server as, for them alone to read: the email, the username or
  the name an OpenID ID token says, on one line, stripped of control and direction characters, cut to
  100 characters, or null when the server sent no ID token or it names nobody.

  The token's signature is not checked, since the label decides nothing: it only tells the member
  which of their accounts they connected, and comes from the token endpoint Strategy Dance itself
  asked, over https, in answer to the member's own code
*/
function readIntegrationAccountLabel(idToken: string | undefined) {
  const [, payload] = idToken?.split('.') ?? []

  if (!payload) return null

  let claims: unknown

  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return null
  }

  if (typeof claims !== 'object' || claims === null) return null

  for (const name of LABEL_CLAIMS) {
    const label = clean((claims as Record<string, unknown>)[name])

    if (label) return label
  }

  return null
}

function clean(value: unknown) {
  if (typeof value !== 'string') return null

  const cleaned = value.replace(/\s+/g, ' ').replace(HIDDEN_CHARACTERS, '').trim()

  return Array.from(cleaned).slice(0, MAX_INTEGRATION_ACCOUNT_LABEL_LENGTH).join('').trim() || null
}

export default readIntegrationAccountLabel
