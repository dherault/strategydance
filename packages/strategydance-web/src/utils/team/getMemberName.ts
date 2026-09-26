import type { OrganizationMember } from '~types'

// What the team page calls a member: the name on their account, or their address when they
// never gave one
function getMemberName(member: OrganizationMember) {
  return member.user.displayName || member.user.email
}

export default getMemberName
