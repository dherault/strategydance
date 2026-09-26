/*
  Whatever an invitation is sent to: some characters, an @, and a domain with a dot in it. Loose
  on purpose, since the only authority on whether an address exists is the mail server that
  receives it, and a stricter pattern mostly refuses real ones.

  No whitespace and no comma anywhere, because the invite field splits on both: an address
  carrying either is two addresses, or a typo.

  The invite field and the backend's validation both call this, so the two cannot disagree about
  what they let through
*/
const EMAIL_ADDRESS_PATTERN = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/

export function isEmailAddress(value: string) {
  return EMAIL_ADDRESS_PATTERN.test(value)
}

/*
  The form an address is stored and compared in. Firebase Auth lowercases the address it puts on
  a token, so an invitation written any other way would never match the person it names
*/
export function normalizeEmailAddress(value: string) {
  return value.trim().toLowerCase()
}
