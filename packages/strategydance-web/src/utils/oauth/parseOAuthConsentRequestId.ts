// A UUID, hyphenated as the backend writes it into the consent page's address, or as 32 hex digits
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i

/*
  The authorization request the consent page's address names, from its `request` as the router
  hands it over, or undefined when it names none. The router parses each value of the query as JSON
  first, so anything but a string names nothing: the backend writes the id hyphenated, which never
  parses as JSON
*/
function parseOAuthConsentRequestId(value: unknown) {
  return typeof value === 'string' && REQUEST_ID_PATTERN.test(value) ? value : undefined
}

export default parseOAuthConsentRequestId
