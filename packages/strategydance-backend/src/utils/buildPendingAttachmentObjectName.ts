import { toCanonicalUuid } from 'strategydance-core'

import buildPendingAttachmentPrefix from '~utils/buildPendingAttachmentPrefix'

type PendingAttachment = {
  organizationId: string
  userId: string
  attachmentId: string
}

/*
  Where a file a member uploaded waits until it is sent: `pending/{organizationId}/{userId}/
  {attachmentId}`, every id canonical, whichever way the route was called, so one attachment has
  one pending object however a retry spells its ids
*/
function buildPendingAttachmentObjectName({ organizationId, userId, attachmentId }: PendingAttachment) {
  return `${buildPendingAttachmentPrefix(organizationId)}${userId}/${toCanonicalUuid(attachmentId)}`
}

export default buildPendingAttachmentObjectName
