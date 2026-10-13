import { isIP } from 'node:net'

import type {
  BetaContentBlock,
  BetaMessageParam,
  BetaMessageStreamParams,
} from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { DirectoryBusinessModel, type Directory, type InactiveDirectory } from 'strategydance-directories'

import type { DirectoryPageProbe, DirectoryProbe } from '~types'

import {
  DIRECTORY_CONVENTIONAL_PATHS,
  DIRECTORY_REVIEW_BETAS,
  DIRECTORY_REVIEW_MAX_FETCHED_TOKENS,
  DIRECTORY_REVIEW_MAX_FETCHES,
  DIRECTORY_REVIEW_MAX_TOKENS,
  DIRECTORY_REVIEW_MODEL,
} from '~domain/directories/directoryCheckSettings'
import DIRECTORY_REVIEW_PROMPT, { DIRECTORY_REVIEW_INACTIVE_REASONS } from '~domain/directories/directoryReviewPrompt'
import toSiteHost from '~domain/directories/toSiteHost'

const VERDICTS = ['ACTIVE', 'INACTIVE', 'INCONCLUSIVE']

function nullable(schema: Record<string, unknown>) {
  return { anyOf: [schema, { type: 'null' }] }
}

/*
  What the answer holds, every field required, those that depend on the verdict null when they do
  not apply. The API takes no bound on a string's length, so the reader holds the description to
  its own
*/
export const DIRECTORY_REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: VERDICTS },
    inactiveReason: nullable({ type: 'string', enum: [...DIRECTORY_REVIEW_INACTIVE_REASONS] }),
    description: nullable({ type: 'string' }),
    isCurrentDescriptionAccurate: { type: 'boolean' },
    businessModel: nullable({
      type: 'string',
      enum: Object.values(DirectoryBusinessModel).filter(model => model !== DirectoryBusinessModel.UNKNOWN),
    }),
    evidence: nullable({
      type: 'object',
      properties: { quote: { type: 'string' }, url: { type: 'string' } },
      required: ['quote', 'url'],
      additionalProperties: false,
    }),
    submissionUrl: nullable({ type: 'string' }),
    notes: { type: 'string' },
  },
  required: [
    'verdict',
    'inactiveReason',
    'description',
    'isCurrentDescriptionAccurate',
    'businessModel',
    'evidence',
    'submissionUrl',
    'notes',
  ],
  additionalProperties: false,
}

/*
  The request that has Claude review a directory: the entry and what the probe read of its pages,
  web fetch held to the site's own hosts, and the answer held to the review's schema. A turn web
  fetch's server-side loop paused is sent back as the parts it came in, which the API reads as one
  turn
*/
function buildDirectoryReviewRequest(
  directory: Directory | InactiveDirectory,
  probe: DirectoryProbe,
  parts: BetaContentBlock[][] = [],
): BetaMessageStreamParams {
  const messages: BetaMessageParam[] = [
    { role: 'user', content: [{ type: 'text', text: describeDirectory(directory, probe) }] },
    ...parts.map(content => ({ role: 'assistant' as const, content })),
  ]

  return {
    model: DIRECTORY_REVIEW_MODEL,
    max_tokens: DIRECTORY_REVIEW_MAX_TOKENS,
    betas: [...DIRECTORY_REVIEW_BETAS],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: DIRECTORY_REVIEW_SCHEMA } },
    system: DIRECTORY_REVIEW_PROMPT,
    tools: [
      {
        type: 'web_fetch_20260209',
        name: 'web_fetch',
        max_uses: DIRECTORY_REVIEW_MAX_FETCHES,
        max_content_tokens: DIRECTORY_REVIEW_MAX_FETCHED_TOKENS,
        allowed_domains: readAllowedDomains(directory, probe),
      },
    ],
    messages,
  }
}

// The entry, and what the probe saw of each page, with every address web fetch may start from
function describeDirectory(directory: Directory | InactiveDirectory, probe: DirectoryProbe) {
  const entry = {
    name: directory.name,
    rootUrl: directory.rootUrl,
    submissionUrl: directory.submissionUrl,
    description: directory.description,
    businessModel: directory.businessModel,
  }
  const lines = [`The entry:\n${JSON.stringify(entry, null, 2)}`]

  if ('inactiveReason' in directory) {
    lines.push(
      `The entry is in the list of inactive directories, as ${directory.inactiveReason}. Answer ACTIVE if a startup can be submitted there again.`,
    )
  }

  lines.push(describePage('Its home page', probe.root, directory.rootUrl))

  if (probe.submission) lines.push(describePage('Its submission page', probe.submission, directory.rootUrl))
  else lines.push('Its submission page is its home page.')

  return lines.join('\n\n')
}

function describePage(label: string, page: DirectoryPageProbe, rootUrl: string) {
  const answer = page.status === null ? `no answer (${page.failure})` : `HTTP ${page.status}`
  const lines = [`${label}, ${page.url}, answered our server with ${answer}.`]

  if (page.finalUrl && page.finalUrl !== page.url) {
    const isElsewhere = toSiteHost(page.finalUrl) !== toSiteHost(rootUrl)

    lines.push(`It redirected to ${page.finalUrl}${isElsewhere ? ', another site than the entry' : ''}.`)
  }

  if (page.status !== null) {
    lines.push(`Title: ${page.title || '(none)'}`)
    lines.push(`Description: ${page.description || '(none)'}`)
    lines.push(
      page.isClientRendered
        ? `Text, almost none, so scripts draw this page: ${page.text || '(none)'}`
        : `Text:\n<<<\n${page.text}\n>>>`,
    )

    if (page.links.length) lines.push(`Links to the same site:\n${page.links.join('\n')}`)

    // Its scripts draw its links too, so the review is given where a site usually explains itself
    if (page.isClientRendered && page.finalUrl) {
      const { origin } = new URL(page.finalUrl)

      lines.push(
        `Pages such a site often has, which may not exist:\n${DIRECTORY_CONVENTIONAL_PATHS.map(path => `${origin}${path}`).join('\n')}`,
      )
    }
  }

  return lines.join('\n')
}

/*
  The hosts web fetch may read: exactly the entry's and those its pages redirected to, `www.`
  included, since a domain allows every subdomain of its own. Never a parent: on a platform's
  subdomain, such as a site on lovable.app, the parent would open every other tenant's site, whose
  pages a review could then quote, and a redirect to www.lovable.app would open it all the same
  without its `www.`. An address written as an IP is no domain the tool takes
*/
function readAllowedDomains(directory: Directory, probe: DirectoryProbe) {
  const urls = [directory.rootUrl, directory.submissionUrl, probe.root.finalUrl, probe.submission?.finalUrl]
  const hosts = urls.flatMap(url => {
    const host = url ? toHostname(url) : ''

    return host && !isIP(host) && host.includes('.') ? [host] : []
  })

  return [...new Set(hosts)]
}

function toHostname(url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

export default buildDirectoryReviewRequest
