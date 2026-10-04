import type { LinkPreviewData } from 'strategydance-core'

import fetchOutbound from '~utils/fetchOutbound'
import logger from '~utils/logger'

import parseLinkPreviewHtml from '~domain/linkPreviews/parseLinkPreviewHtml'

// The start of a page holds its head, which is all a card reads
const MAX_HTML_BYTES = 1024 * 1024
const TIMEOUT_MS = 5000
const MAX_REDIRECTS = 5

// Who is asking, for a site that answers bots a page of its own
const USER_AGENT = 'Mozilla/5.0 (compatible; StrategyDanceBot/1.0; +https://strategydance.com)'

/*
  What a web page says of itself, for a link preview card: fetched through `fetchOutbound`, which
  reaches public addresses alone, and read from the HTML it answers with. Anything else, a page
  that is not HTML, an error status, an address refused, a timeout, is the address alone, so the
  card always draws. Why is logged
*/
async function readLinkPreview(url: string, fetch = fetchOutbound): Promise<LinkPreviewData> {
  try {
    const response = await fetch(url, {
      maxBytes: MAX_HTML_BYTES,
      timeoutMs: TIMEOUT_MS,
      maxRedirects: MAX_REDIRECTS,
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': USER_AGENT,
      },
    })
    const contentType = response.headers['content-type'] ?? ''

    if (response.status < 200 || response.status >= 300) {
      logger.info(`Link previews: ${url} answered ${response.status}`)

      return { url }
    }

    if (!/^\s*(text\/html|application\/xhtml\+xml)/i.test(contentType)) {
      logger.info(`Link previews: ${url} is not a page but ${contentType || 'nothing it names'}`)

      return { url }
    }

    // As UTF-8, which nearly every page is, and the tags a card reads are written in
    return { url, ...(await parseLinkPreviewHtml(response.body.toString('utf8'), response.url)) }
  } catch (error) {
    logger.warn(`Link previews: could not read ${url}`, error)

    return { url }
  }
}

export default readLinkPreview
