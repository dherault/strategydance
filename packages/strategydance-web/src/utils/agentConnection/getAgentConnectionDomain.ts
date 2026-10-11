/*
  The domain that vouches for a connected agent's name: its client ID metadata document's, when its
  `client_id` is that document's `https` address, as the backend reads it on the consent page. Null
  for a client that registered itself, whose `client_id` is an id the backend made, which nothing
  vouches for
*/
function getAgentConnectionDomain(clientId: string) {
  if (!URL.canParse(clientId)) return null

  const url = new URL(clientId)

  return url.protocol === 'https:' ? url.hostname : null
}

export default getAgentConnectionDomain
