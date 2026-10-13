import toCanonicalUuid from '~utils/toCanonicalUuid'

/*
  Where an organization's files wait in the bucket between their upload and their send, outside
  `organizations/`, where a bucket lifecycle rule deletes what is two days old, so a draft never sent
  costs nothing for long. Deleting the organization sweeps it beside its own folder
*/
function buildPendingAttachmentPrefix(organizationId: string) {
  return `pending/${toCanonicalUuid(organizationId)}/`
}

export default buildPendingAttachmentPrefix
