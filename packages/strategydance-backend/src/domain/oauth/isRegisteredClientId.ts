// The `client_id` registration answers: the client's UUID as Data Connect writes it, 32 lowercase
// hex digits, and no other spelling, so one client never stands for two
const REGISTERED_CLIENT_ID_PATTERN = /^[0-9a-f]{32}$/

function isRegisteredClientId(clientId: string) {
  return REGISTERED_CLIENT_ID_PATTERN.test(clientId)
}

export default isRegisteredClientId
