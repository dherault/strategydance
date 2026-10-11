/*
  Whether `ApproveOAuthAuthorizationRequest` refused a caller who is not the organization's member:
  by its lock's check, or first by the connection's reference to the membership, which Data Connect
  reports before the check
*/
function isMembershipRefusal(message: string) {
  return (
    message.includes('Only a member of an organization can connect an agent to it')
    || message.includes('agent_connection_membership_fkey')
  )
}

export default isMembershipRefusal
