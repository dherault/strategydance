import {
  claimExpiredMemberConversationAttachments,
  getPruningMemberConversationAttachments,
} from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import deletePrunedConversationAttachments from '~domain/conversations/deletePrunedConversationAttachments'

type MemberReference = {
  organizationId: string
  userId: string
}

/*
  Prunes a member's unsent files that expired, as each of their uploads does before it counts their
  files: a reservation ten minutes old whose upload failed, and a file uploaded two days ago, claimed
  first, so no upload finishes and no send takes them, then deleted with their files. Claimed files a
  prune before could not delete are finished too. One batch, since a member has at most 30 unsent
  files and the daily sweep is the fallback
*/
async function pruneMemberConversationAttachments(reference: MemberReference) {
  await claimExpiredMemberConversationAttachments(dataConnect, reference)

  const { data } = await getPruningMemberConversationAttachments(dataConnect, reference)

  return deletePrunedConversationAttachments(data.conversationAttachments)
}

export default pruneMemberConversationAttachments
