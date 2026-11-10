import type { LinkPreviewData } from 'strategydance-core'

import { OUTBOUND_USER_AGENT } from '~constants'

import fetchOutbound from '~utils/fetchOutbound'
import logger from '~utils/logger'

import parseLinkPreviewHtml from '~domain/linkPreviews/parseLinkPreviewHtml'

// The start of a page holds its head, which is all a card reads
const MAX_HTML_BYTES = 1024 * 1024
const TIMEOUT_MS = 5000
const MAX_REDIRECTS = 5

// What a log names an address by: its origin alone, or what it is when it has none, as an address
// that does not parse, and a `data:` or `mailto:` one, whose origin reads "null"
function toLoggedOrigin(url: string) {
  const origin = URL.canParse(url) ? new URL(url).origin : 'null'

  return origin === 'null' ? 'an address that is not a web one' : origin
}

/*
  What a web page says of itself, for a link preview card: fetched through `fetchOutbound`, which
  reaches public addresses alone, and read from the HTML it answers with. Anything else, a page
  that is not HTML, an error status, an address refused, a timeout, is the address alone, so the
  card always draws. Why is logged, naming the address's origin alone, since a path or a query can
  hold a secret, as a reset link or a signed address does
*/
async function readLinkPreview(url: string, fetch = fetchOutbound): Promise<LinkPreviewData> {
  const origin = toLoggedOrigin(url)

  try {
    const response = await fetch(url, {
      maxBytes: MAX_HTML_BYTES,
      timeoutMs: TIMEOUT_MS,
      maxRedirects: MAX_REDIRECTS,
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': OUTBOUND_USER_AGENT,
      },
    })
    const contentType = response.headers['content-type'] ?? ''

    if (response.status < 200 || response.status >= 300) {
      logger.info(`Link previews: ${origin} answered ${response.status}`)

      return { url }
    }

    if (!/^\s*(text\/html|application\/xhtml\+xml)/i.test(contentType)) {
      logger.info(`Link previews: ${origin} answered something other than a page`)

      return { url }
    }

    // As UTF-8, which nearly every page is, and the tags a card reads are written in
    return { url, ...(await parseLinkPreviewHtml(response.body.toString('utf8'), response.url)) }
  } catch (error) {
    logger.warn(`Link previews: could not read ${origin}`, error)

    return { url }
  }
}

export default readLinkPreview
