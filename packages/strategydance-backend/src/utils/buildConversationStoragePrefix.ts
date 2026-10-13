import buildOrganizationStoragePrefix from '~utils/buildOrganizationStoragePrefix'
import toCanonicalUuid from '~utils/toCanonicalUuid'

type ConversationFolder = {
  organizationId: string
  userId: string
  conversationId: string
}

/*
  Where the files a conversation sent live: `organizations/{organizationId}/users/{userId}/
  conversations/{conversationId}/`, inside the organization's folder, so deleting the organization
  sweeps them with the rest, and every id canonical, so one attachment has one copy however a retry
  spells its ids. A file's copy is its canonical id under it
*/
function buildConversationStoragePrefix({ organizationId, userId, conversationId }: ConversationFolder) {
  return `${buildOrganizationStoragePrefix(organizationId)}users/${userId}/conversations/${toCanonicalUuid(conversationId)}/`
}

export default buildConversationStoragePrefix
