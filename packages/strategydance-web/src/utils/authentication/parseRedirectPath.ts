/*
  Where the sign-in screen may send somebody once they are in: a page of the authenticated area,
  given as a path on this site, or nowhere.

  The value arrives in a URL anybody can write, so anything else is dropped rather than followed.
  A path must start with `/-/`, which keeps it inside the authenticated area and on this origin,
  and may not contain `//` or a backslash anywhere, which a browser can read as another host
*/
function parseRedirectPath(value: unknown) {
  if (typeof value !== 'string') return null
  if (!value.startsWith('/-/')) return null
  if (value.includes('//') || value.includes('\\')) return null

  return value
}

export default parseRedirectPath
