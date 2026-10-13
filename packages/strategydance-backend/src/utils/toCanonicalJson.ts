/*
  A value as canonical JSON: keys sorted at every depth and a key whose value is undefined left out,
  so the same value serializes to the same text however it was built, which is what hashing it
  needs
*/
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

export default toCanonicalJson
