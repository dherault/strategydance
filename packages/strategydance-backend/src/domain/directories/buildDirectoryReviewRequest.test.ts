import { describe, expect, test } from 'bun:test'

import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import buildDirectoryReviewRequest, { DIRECTORY_REVIEW_SCHEMA } from '~domain/directories/buildDirectoryReviewRequest'
import {
  createDirectory,
  createInactiveDirectory,
  createPageProbe,
} from '~domain/directories/testing/directoryFixtures'

const DIRECTORY = createDirectory('tools', {
  rootUrl: 'https://app.tools.example/',
  submissionUrl: 'https://app.tools.example/submit',
})

const PROBE = {
  root: createPageProbe(DIRECTORY.rootUrl, {
    finalUrl: 'https://www.portal.tools.example/home',
    links: ['https://www.portal.tools.example/faq'],
  }),
  submission: createPageProbe(DIRECTORY.submissionUrl, { text: 'Nothing', isClientRendered: true }),
}

function readText(request: ReturnType<typeof buildDirectoryReviewRequest>) {
  const [message] = request.messages
  const [block] = message.content as { type: 'text'; text: string }[]

  return block.text
}

describe('buildDirectoryReviewRequest', () => {
  test('asks for the schema, with fallbacks, web fetch held to the site', () => {
    const request = buildDirectoryReviewRequest(DIRECTORY, PROBE)

    expect(request).toMatchObject({
      model: 'claude-opus-5-5',
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: DIRECTORY_REVIEW_SCHEMA } },
      tools: [
        {
          type: 'web_fetch_20260209',
          name: 'web_fetch',
          max_uses: 3,
          max_content_tokens: 8000,
          allowed_domains: ['app.tools.example', 'portal.tools.example'],
        },
      ],
    })
    expect(request).not.toHaveProperty('thinking')
  })

  test('requires every field of the answer, and nothing else', () => {
    expect(DIRECTORY_REVIEW_SCHEMA.required.toSorted()).toEqual(
      Object.keys(DIRECTORY_REVIEW_SCHEMA.properties).toSorted(),
    )
    expect(DIRECTORY_REVIEW_SCHEMA.additionalProperties).toBe(false)
  })

  test('gives the entry and what the probe read of each page', () => {
    const text = readText(buildDirectoryReviewRequest(DIRECTORY, PROBE))

    expect(text).toContain('"submissionUrl": "https://app.tools.example/submit"')
    expect(text).toContain('Its home page, https://app.tools.example/, answered our server with HTTP 200.')
    expect(text).toContain('It redirected to https://www.portal.tools.example/home, another site than the entry.')
    expect(text).toContain('Listings are free once our badge is on your site.')
    expect(text).toContain('Text, almost none, so scripts draw this page: Nothing')
    expect(text).toContain('Links to the same site:\nhttps://www.portal.tools.example/faq')
    // Only for the page its scripts draw, whose links nobody saw
    expect(text).toContain(
      'Pages such a site often has, which may not exist:\nhttps://app.tools.example/pricing\nhttps://app.tools.example/faq',
    )
    expect(text).not.toContain('https://www.portal.tools.example/pricing')
    expect(text).not.toContain('inactive')
  })

  test('says why a page did not answer, and when an entry is inactive', () => {
    const directory = createInactiveDirectory('gone', { submissionUrl: 'https://gone.example/' })
    const text = readText(
      buildDirectoryReviewRequest(directory, {
        root: createPageProbe(directory.rootUrl, { status: null, finalUrl: null, failure: 'EAI_AGAIN: try again' }),
        submission: null,
      }),
    )

    expect(text).toContain('answered our server with no answer (EAI_AGAIN: try again).')
    expect(text).toContain('Its submission page is its home page.')
    expect(text).toContain('in the list of inactive directories, as PARKED')
  })

  test('allows no parent domain, which would open other tenants of a platform, and no IP', () => {
    const directory = createDirectory('lovable', {
      rootUrl: 'https://launched.lovable.app/',
      submissionUrl: 'https://launched.lovable.app/submit',
    })
    const request = buildDirectoryReviewRequest(directory, {
      root: createPageProbe(directory.rootUrl, { finalUrl: 'https://203.0.113.9/' }),
      submission: null,
    })

    expect(request.tools).toMatchObject([{ allowed_domains: ['launched.lovable.app'] }])
  })

  test('sends a paused turn back as its parts', () => {
    const part: BetaContentBlock[] = [{ type: 'text', text: 'Reading the FAQ', citations: null }]

    expect(buildDirectoryReviewRequest(DIRECTORY, PROBE, [part]).messages.slice(1)).toEqual([
      { role: 'assistant', content: part },
    ])
  })
})
