import type { RichTextImageData } from 'strategydance-core'

import { requestApi } from '~data/api'

/*
  Stores a picture put in one of an organization's documents, through the backend, which only
  lets a member of the organization, and answers with the address the document's text keeps
*/
async function uploadRichTextImage(organizationId: string, file: File) {
  const { url } = await requestApi<RichTextImageData>({
    method: 'POST',
    path: `/organizations/${organizationId}/rich-text/images`,
    body: file,
  })

  return url
}

export default uploadRichTextImage
