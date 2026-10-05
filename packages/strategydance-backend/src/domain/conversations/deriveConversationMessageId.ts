import { createHash } from 'node:crypto'

import { UUID_PATTERN } from '~constants'

import toCanonicalUuid from '~utils/toCanonicalUuid'

/*
  The id of a message the backend draws, derived from what it is drawn from: a transcript entry's id
  with its blocks and its piece, or a run's id with what its note says. Drawing the same thing twice,
  as a worker taking over after a crash can, then inserts one id twice, which the database refuses,
  rather than a second copy. A UUID among the parts counts in its canonical form, so an id read back
  from Data Connect, without hyphens, derives what the same id with them does.

  The first 128 bits of the parts' SHA-256, marked as a version 8 UUID, the version RFC 9562 leaves
  to an application's own scheme, and written as Data Connect writes an id back
*/
function deriveConversationMessageId(...parts: (string | number)[]) {
  const key = parts
    .map(part => (typeof part === 'string' && UUID_PATTERN.test(part) ? toCanonicalUuid(part) : String(part)))
    .join(':')
  const digest = createHash('sha256').update(key).digest('hex')
  const variant = ((Number.parseInt(digest.charAt(16), 16) & 0x3) | 0x8).toString(16)

  return `${digest.slice(0, 12)}8${digest.slice(13, 16)}${variant}${digest.slice(17, 32)}`
}

export default deriveConversationMessageId
