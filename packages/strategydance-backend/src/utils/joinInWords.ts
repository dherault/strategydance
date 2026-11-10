// Items as an English sentence lists them, "A", "A and B" or "A, B and C", joined with "or" for a
// choice: what a server's instructions and a tool's description write, never a member's language
function joinInWords(items: readonly string[], conjunction: 'and' | 'or' = 'and') {
  const rest = items.slice(0, -1)
  const last = items.at(-1) ?? ''

  return rest.length ? `${rest.join(', ')} ${conjunction} ${last}` : last
}

export default joinInWords
