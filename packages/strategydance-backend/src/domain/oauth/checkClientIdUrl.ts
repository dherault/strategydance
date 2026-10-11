import { MAX_OAUTH_PARAMETER_LENGTH } from '~constants'

/*
  Whether a `client_id` is the address of a client ID metadata document the server can fetch: an
  `https` address with a path, on the default port, since `fetchOutbound` reaches no other, with no
  user, no fragment and no dot segment, written as the URL parser writes it, so the document's own
  `client_id` can be compared with it character for character. Checked before anybody has signed in,
  without fetching anything
*/
function checkClientIdUrl(clientId: string) {
  if (clientId.length > MAX_OAUTH_PARAMETER_LENGTH || !URL.canParse(clientId)) return false

  const url = new URL(clientId)

  return (
    url.protocol === 'https:'
    && url.href === clientId
    && !url.port
    && !url.username
    && !url.password
    && !url.hash
    && url.pathname !== '/'
  )
}

export default checkClientIdUrl
