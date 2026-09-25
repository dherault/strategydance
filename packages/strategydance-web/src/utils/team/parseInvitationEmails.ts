import { isEmailAddress, normalizeEmailAddress } from 'strategydance-core'

export type ParsedInvitationEmails = {
  // New addresses, normalized and each once: what would be sent
  valid: string[]
  // What was typed that is not an address, as it was typed
  invalid: string[]
  // Addresses that belong to a member already
  members: string[]
  // Addresses with an invitation still pending
  invited: string[]
}

// Commas and new lines, as the field's hint says, and spaces and semicolons, which a list pasted
// from an email client carries between addresses
const SEPARATOR_PATTERN = /[\s,;]+/

/*
  Sorts what was typed into the invite field. Each address is compared, and kept, in its
  normalized form, so `Jane@Company.com` and `jane@company.com` are one address and match the
  member whose account uses either. The design's own parser, ported, with the four lists it
  reports errors from
*/
function parseInvitationEmails(text: string, memberEmails: ReadonlySet<string>, invitedEmails: ReadonlySet<string>): ParsedInvitationEmails {
  const parsed: ParsedInvitationEmails = {
    valid: [],
    invalid: [],
    members: [],
    invited: [],
  }

  const seen = new Set<string>()

  for (const token of text.split(SEPARATOR_PATTERN)) {
    if (!token) continue

    const email = normalizeEmailAddress(token)

    if (seen.has(email)) continue

    seen.add(email)

    if (!isEmailAddress(email)) parsed.invalid.push(token)
    else if (memberEmails.has(email)) parsed.members.push(email)
    else if (invitedEmails.has(email)) parsed.invited.push(email)
    else parsed.valid.push(email)
  }

  return parsed
}

export default parseInvitationEmails
