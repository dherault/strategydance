// Whether a route's parameter can be a conversation's id: 32 hex digits, as `createId` makes one and
// Data Connect writes one back
function isConversationId(value: string) {
  return /^[0-9a-f]{32}$/.test(value)
}

export default isConversationId
