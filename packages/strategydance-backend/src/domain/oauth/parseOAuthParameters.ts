/*
  What an authorization or a token request says, read from its query or its form body. Every
  parameter may occur once: a request repeating any of them, one it does not read included, is
  refused, since parsers disagree on which copy counts. A parameter sent without a value counts as
  not sent (RFC 6749, 3.1). Only the names asked for are read, so a code exchange carrying a refresh
  token's parameters reads none of them
*/
type OAuthParameters<Name extends string> =
  | { isRepeated: false; values: Partial<Record<Name, string>> }
  | { isRepeated: true; name: string }

function parseOAuthParameters<Name extends string>(source: string, names: readonly Name[]): OAuthParameters<Name> {
  const search = new URLSearchParams(source)
  const seen = new Set<string>()

  for (const name of search.keys()) {
    if (seen.has(name)) return { isRepeated: true, name }

    seen.add(name)
  }

  const values: Partial<Record<Name, string>> = {}

  for (const name of names) {
    const value = search.get(name)

    if (value) values[name] = value
  }

  return { isRepeated: false, values }
}

export default parseOAuthParameters
