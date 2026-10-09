import { createHash } from 'node:crypto'

/*
  A call's arguments hashed with SHA-256, in hex, as canonical JSON: keys sorted at every depth and
  a key whose value is undefined left out, so a call a client sends again under its idempotency key
  matches however the client serializes it the second time
*/
function hashModuleCallArguments(args: unknown) {
  return createHash('sha256').update(toCanonicalJson(args)).digest('hex')
}

function toCanonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(toCanonicalJson).join(',')}]`

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))

    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${toCanonicalJson(item)}`).join(',')}}`
  }

  return JSON.stringify(value) ?? 'null'
}

export default hashModuleCallArguments
