import { createHash } from 'node:crypto'

// How many hex digits of the SHA-256 a version keeps: enough that two descriptions never share one
const VERSION_LENGTH = 24

// A task's description's version, as `read_task` gives it and replacing the description has to name:
// a hash of the description as stored, so any save moves it
function hashTaskDescription(description: string) {
  return createHash('sha256').update(description).digest('hex').slice(0, VERSION_LENGTH)
}

export default hashTaskDescription
