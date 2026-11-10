import { createHash } from 'node:crypto'

// How many hex digits of the SHA-256 a version keeps: enough that two notes never share one
const VERSION_LENGTH = 24

// A note's version, as `read_knowledge` gives it and replacing the note has to name: a hash of the
// note as stored, an empty string for an item never noted, so any save moves it
function hashKnowledgeNote(content: string) {
  return createHash('sha256').update(content).digest('hex').slice(0, VERSION_LENGTH)
}

export default hashKnowledgeNote
