import type { LinkPreviewData } from 'strategydance-core'

import { requestApi } from '~data/api'

// What a web page says of itself, which the backend reads, as the browser cannot read another site's page
async function readLinkPreview(url: string) {
  return requestApi<LinkPreviewData>({ method: 'POST', path: '/link-previews', body: { url } })
}

export default readLinkPreview
