/*
  Whether `ApproveOAuthAuthorizationRequest` refused a caller who is not a member of every
  organization they chose, which the count of the memberships it locks checks
*/
function isMembershipRefusal(message: string) {
  return message.includes('Only a member of an organization can connect an agent to it')
}

export default isMembershipRefusal
