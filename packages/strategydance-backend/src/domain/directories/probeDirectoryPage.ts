import type { DirectoryPageOutcome, DirectoryPageProbe } from '~types'

import { OUTBOUND_USER_AGENT } from '~constants'

import fetchOutbound, { OutboundRefusal } from '~utils/fetchOutbound'

import {
  DIRECTORY_PAGE_MAX_BYTES,
  DIRECTORY_PAGE_MAX_REDIRECTS,
  DIRECTORY_PAGE_MIN_TEXT_LENGTH,
  DIRECTORY_PAGE_TIMEOUT_MS,
} from '~domain/directories/directoryCheckSettings'
import readDirectoryPage from '~domain/directories/readDirectoryPage'

// The errors that say there is no site: no such name, a connection refused, dropped or never
// answered, a host that cannot be routed to, and a certificate no browser would take
const UNREACHABLE_CODES = new Set([
  'ENOTFOUND',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
])

const BLOCKED_STATUSES = new Set([401, 403, 407, 429, 451])

const MISSING_STATUSES = new Set([404, 410])

/*
  One page of a directory, as this server's GET of it answers, through `fetchOutbound`, which
  reaches public addresses alone: whether a site is there, and what a reader of it sees. A status a
  bot wall answers with, and a challenge, are `blocked`, never `unreachable`: Cloudflare answers a
  challenge with a 503 marked `cf-mitigated`, and a site that sets a cookie before it answers
  redirects a visitor without one forever. An error nobody can tell from a passing fault, a name
  that could not be resolved for now included, is `unknown`
*/
async function probeDirectoryPage(url: string, fetch = fetchOutbound): Promise<DirectoryPageProbe> {
  try {
    const response = await fetch(url, {
      maxBytes: DIRECTORY_PAGE_MAX_BYTES,
      timeoutMs: DIRECTORY_PAGE_TIMEOUT_MS,
      maxRedirects: DIRECTORY_PAGE_MAX_REDIRECTS,
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': OUTBOUND_USER_AGENT,
      },
    })
    const outcome = classifyStatus(response.status, response.headers['cf-mitigated'])
    const contentType = response.headers['content-type'] ?? ''
    const isHtml = /^\s*(text\/html|application\/xhtml\+xml)/i.test(contentType)
    // As UTF-8, which nearly every page is
    const page = isHtml
      ? await readDirectoryPage(response.body.toString('utf8'), response.url)
      : { title: '', description: '', text: '', links: [] }

    return {
      url,
      finalUrl: response.url,
      status: response.status,
      outcome,
      failure: outcome === 'reachable' ? null : `HTTP ${response.status}`,
      ...page,
      isClientRendered: page.text.length < DIRECTORY_PAGE_MIN_TEXT_LENGTH,
    }
  } catch (error) {
    const { outcome, failure } = classifyError(error)

    return {
      url,
      finalUrl: null,
      status: null,
      outcome,
      failure,
      title: '',
      description: '',
      text: '',
      links: [],
      isClientRendered: true,
    }
  }
}

function classifyStatus(status: number, mitigation: string | string[] | undefined): DirectoryPageOutcome {
  if (status >= 200 && status < 300) return 'reachable'
  if (MISSING_STATUSES.has(status)) return 'missing'
  if (BLOCKED_STATUSES.has(status) || mitigation === 'challenge') return 'blocked'
  // Cloudflare's 52x included: its edge answered, the site behind it did not
  if (status >= 500) return 'unreachable'

  return 'unknown'
}

function classifyError(error: unknown): { outcome: DirectoryPageOutcome; failure: string } {
  if (error instanceof OutboundRefusal) {
    // A dead domain often resolves to a private address; a redirect loop is a cookie wall
    if (error.reason === 'privateAddress') return { outcome: 'unreachable', failure: error.message }
    if (error.reason === 'redirects') return { outcome: 'blocked', failure: error.message }

    return { outcome: 'unknown', failure: error.message }
  }

  if (!(error instanceof Error)) return { outcome: 'unknown', failure: String(error) }

  const code = 'code' in error && typeof error.code === 'string' ? error.code : ''

  // The probe's own deadline
  if (error.name === 'AbortError' || error.name === 'TimeoutError') {
    return { outcome: 'unreachable', failure: 'Timed out' }
  }

  if (UNREACHABLE_CODES.has(code) || /CERT|TLS|SSL/.test(code)) {
    return { outcome: 'unreachable', failure: `${code}: ${error.message}` }
  }

  return { outcome: 'unknown', failure: code ? `${code}: ${error.message}` : error.message }
}

export default probeDirectoryPage
