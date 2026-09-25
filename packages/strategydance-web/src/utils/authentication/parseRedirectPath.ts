// Any origin will do, as long as nothing real can own it: it only anchors the parse
const PARSE_ORIGIN = 'https://redirect.invalid'

/*
  Where the sign-in screen may send somebody once they are in: a page of the authenticated area,
  given as a path on this site, or nowhere.

  The value arrives in a URL anybody can write, so it is checked as the browser will read it,
  after parsing, not as it was typed: `/-/../authentication` is written under `/-/` and lands
  outside it, and a backslash or a second slash can turn a path into another host. The parsed
  path has to stay on this origin, start with `/-/`, and hold no empty segment. What comes back
  is that normalized form, never the raw string
*/
function parseRedirectPath(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/')) return null

  let url: URL

  try {
    url = new URL(value, PARSE_ORIGIN)
  }
  catch {
    return null
  }

  if (url.origin !== PARSE_ORIGIN) return null
  if (!url.pathname.startsWith('/-/') || url.pathname.includes('//')) return null

  return `${url.pathname}${url.search}${url.hash}`
}

export default parseRedirectPath
