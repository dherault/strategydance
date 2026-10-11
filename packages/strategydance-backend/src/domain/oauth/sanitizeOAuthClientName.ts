import { MAX_OAUTH_CLIENT_NAME_LENGTH } from '~constants'

// Control and format characters, the direction marks and overrides among them, and line and
// paragraph separators, which could make a name read as something else on the consent page
const HIDDEN_CHARACTERS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu

/*
  A client's name as the consent page shows it: its spaces and line breaks collapsed into single
  spaces, then stripped of control and direction characters, cut to 80 characters, and null when
  nothing is left, or when it named none
*/
function sanitizeOAuthClientName(name: unknown) {
  if (typeof name !== 'string') return null

  const cleaned = name.replace(/\s+/g, ' ').replace(HIDDEN_CHARACTERS, '').trim()
  const characters = Array.from(cleaned).slice(0, MAX_OAUTH_CLIENT_NAME_LENGTH)

  return characters.join('').trim() || null
}

export default sanitizeOAuthClientName
