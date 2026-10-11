/*
  Whether an exchange or a rotation was refused because its connection went meanwhile, replaced by
  a new consent, revoked, or its member removed: the new tokens' reference to it fails, which Data
  Connect reports before the step's own check. The grant is then refused as revoked, never answered
  as the server's error
*/
function isConnectionGoneRefusal(message: string) {
  return message.includes('agent_connection_token_connection_id_fkey')
}

export default isConnectionGoneRefusal
