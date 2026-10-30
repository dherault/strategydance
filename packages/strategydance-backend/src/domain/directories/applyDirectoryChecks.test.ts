import { describe, expect, test } from 'bun:test'

import { type Directory, DirectoryCategory, type InactiveDirectory } from 'strategydance-knowledge'

import type { DirectoryCheck, DirectoryLists, DirectoryPage, DirectoryPageProbe, DirectoryReviewAnswer } from '~types'

import applyDirectoryChecks from '~domain/directories/applyDirectoryChecks'
import {
  createAnswer,
  createDirectory,
  createInactiveDirectory,
  createPageProbe,
} from '~domain/directories/testing/directoryFixtures'

const TODAY = '2026-10-20'

const USAGE = { inputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0, outputTokens: 0 }

const QUOTE = 'Listings are free once our badge is on your site'

function createLists(directories: Directory[], inactiveDirectories: InactiveDirectory[] = []): DirectoryLists {
  return { directories, inactiveDirectories }
}

function createCheck(
  directory: Directory,
  {
    root = {},
    answer,
    fetchedPages = [],
    submissionProbe = null,
  }: {
    root?: Partial<DirectoryPageProbe>
    answer?: Partial<DirectoryReviewAnswer> | 'unanswered' | 'failed'
    fetchedPages?: DirectoryPage[]
    submissionProbe?: DirectoryPageProbe | null
  } = {},
): DirectoryCheck {
  const probe = { root: createPageProbe(directory.rootUrl, root), submission: null }
  const check = { name: directory.name, directory, probe, submissionProbe }

  if (answer === 'unanswered') return { ...check, review: { outcome: 'unanswered', failure: 'Refused', usage: USAGE } }
  if (answer === 'failed') return { ...check, review: { outcome: 'failed', failure: 'Overloaded', usage: USAGE } }

  return {
    ...check,
    review: answer ? { outcome: 'answered', answer: createAnswer(answer), fetchedPages, usage: USAGE } : null,
  }
}

function apply(lists: DirectoryLists, check: DirectoryCheck) {
  const { lists: applied, outcomes } = applyDirectoryChecks(lists, [check], TODAY)

  return { ...applied, outcome: outcomes[0] }
}

const UNREACHABLE = { outcome: 'unreachable', status: null, failure: 'ENOTFOUND: getaddrinfo ENOTFOUND' } as const

describe('applyDirectoryChecks', () => {
  test('describes an active directory, and dates its check', () => {
    const directory = createDirectory('tools', { lastChecked: '2026-09-01' })
    const { directories, outcome } = apply(createLists([directory]), createCheck(directory, { answer: {} }))

    expect(directories).toEqual([
      {
        ...directory,
        description: createAnswer().description!,
        categories: [DirectoryCategory.ANY_STARTUP],
        lastChecked: TODAY,
      },
    ])
    expect(outcome).toMatchObject({
      result: 'active',
      changes: [expect.stringContaining('Description written'), 'Categories written: ANY_STARTUP'],
    })
  })

  test('keeps a description the review found right, and rewrites one it found wrong', () => {
    const directory = createDirectory('tools', { description: 'Directory of tools.' })

    expect(apply(createLists([directory]), createCheck(directory, { answer: {} })).directories[0].description).toBe(
      'Directory of tools.',
    )
    expect(
      apply(createLists([directory]), createCheck(directory, { answer: { isCurrentDescriptionAccurate: false } }))
        .directories[0].description,
    ).toBe(createAnswer().description!)
  })

  test('keeps categories the review found right, and rewrites ones it found wrong', () => {
    const directory = createDirectory('tools', { categories: [DirectoryCategory.AI_TOOLS] })
    const categories = [DirectoryCategory.AI_TOOLS, DirectoryCategory.AI_AGENTS]

    expect(apply(createLists([directory]), createCheck(directory, { answer: { categories } })).directories[0]).toEqual(
      expect.objectContaining({ categories: [DirectoryCategory.AI_TOOLS] }),
    )

    const { directories, outcome } = apply(
      createLists([directory]),
      createCheck(directory, { answer: { categories, areCurrentCategoriesAccurate: false } }),
    )

    expect(directories[0].categories).toEqual(categories)
    expect(outcome.changes).toContain('Categories AI_TOOLS → AI_TOOLS, AI_AGENTS')
  })

  test('writes no categories from an answer that named none', () => {
    const directory = createDirectory('tools')

    expect(
      apply(createLists([directory]), createCheck(directory, { answer: { categories: null } })).directories[0]
        .categories,
    ).toEqual([])
  })

  test('changes a business model only on a quote found in what was read', () => {
    const directory = createDirectory('tools')
    const answer = {
      businessModel: 'FREE_WITH_BADGE',
      evidence: { quote: QUOTE, url: directory.rootUrl },
    } as const

    const quoted = apply(createLists([directory]), createCheck(directory, { answer }))
    const invented = apply(
      createLists([directory]),
      createCheck(directory, {
        answer: { ...answer, evidence: { ...answer.evidence, quote: 'Badge required for every listing' } },
      }),
    )

    expect(quoted.directories[0].businessModel).toBe('FREE_WITH_BADGE')
    expect(quoted.outcome).toMatchObject({
      changes: expect.arrayContaining(['Business model FREE → FREE_WITH_BADGE']),
      evidence: answer.evidence,
    })
    expect(invented.directories[0].businessModel).toBe('FREE')
    expect(invented.outcome.notes).toContain('without a quote found')
  })

  test('reads quotes in what Claude fetched too, on the page the quote names', () => {
    const directory = createDirectory('tools')
    const pricing = { url: 'https://www.tools.example/pricing/', text: 'Pricing. Every listing is $49, once.' }
    const check = (url: string, fetchedPages: DirectoryPage[] = [pricing]) =>
      createCheck(directory, {
        answer: { businessModel: 'PAID', evidence: { quote: 'Every listing is $49', url } },
        fetchedPages,
      })

    expect(apply(createLists([directory]), check('https://tools.example/pricing')).directories[0].businessModel).toBe(
      'PAID',
    )
    expect(apply(createLists([directory]), check('https://tools.example/faq')).directories[0].businessModel).toBe(
      'FREE',
    )
    // Another scheme or port is another origin, whose page never vouches for this one
    expect(apply(createLists([directory]), check('http://tools.example/pricing')).directories[0].businessModel).toBe(
      'FREE',
    )
    expect(
      apply(createLists([directory]), check('https://tools.example:8443/pricing')).directories[0].businessModel,
    ).toBe('FREE')
    expect(
      apply(createLists([directory]), check('https://tools.example/pricing', [])).directories[0].businessModel,
    ).toBe('FREE')
  })

  test('takes a moved submission page only when it answered, on the site, and is nobody else’s', () => {
    const directory = createDirectory('tools')
    const other = createDirectory('other', { submissionUrl: 'https://tools.example/taken' })
    const check = (submissionUrl: string, probe: Partial<DirectoryPageProbe> = {}) =>
      createCheck(directory, { answer: { submissionUrl }, submissionProbe: createPageProbe(submissionUrl, probe) })
    const lists = createLists([directory, other])

    expect(apply(lists, check('https://tools.example/new-submit')).directories[0].submissionUrl).toBe(
      'https://tools.example/new-submit',
    )
    expect(apply(lists, check('https://tools.example/gone', { outcome: 'missing' })).directories[0].submissionUrl).toBe(
      directory.submissionUrl,
    )
    expect(apply(lists, check('https://forms.example/tools')).directories[0].submissionUrl).toBe(
      directory.submissionUrl,
    )
    expect(apply(lists, check('https://tools.example/taken')).directories[0].submissionUrl).toBe(
      directory.submissionUrl,
    )
  })

  test('counts a first unreachable check without moving the directory', () => {
    const directory = createDirectory('tools')
    const { directories, outcome } = apply(createLists([directory]), createCheck(directory, { root: UNREACHABLE }))

    expect(directories).toEqual([{ ...directory, lastChecked: TODAY, unreachableSince: TODAY }])
    expect(outcome).toMatchObject({ result: 'unreachable', notes: 'Unreachable: ENOTFOUND: getaddrinfo ENOTFOUND' })
  })

  test('moves a directory still unreachable three days after the first check', () => {
    const recent = createDirectory('recent', { unreachableSince: '2026-10-18' })
    const old = createDirectory('old', { unreachableSince: '2026-10-17' })
    const lists = createLists([recent, old])

    expect(apply(lists, createCheck(recent, { root: UNREACHABLE })).directories).toContainEqual({
      ...recent,
      lastChecked: TODAY,
    })

    const moved = apply(lists, createCheck(old, { root: { outcome: 'missing', status: 404, failure: 'HTTP 404' } }))

    expect(moved.directories.map(({ name }) => name)).toEqual(['recent'])
    expect(moved.inactiveDirectories).toEqual([{ ...old, lastChecked: TODAY, inactiveReason: 'UNREACHABLE' }])
    expect(moved.outcome).toMatchObject({ result: 'movedToInactive', notes: 'Unreachable since 2026-10-17: HTTP 404' })
  })

  test('forgets an unreachable check once the root answers, a bot wall included', () => {
    const directory = createDirectory('tools', { unreachableSince: '2026-10-18' })

    expect(
      apply(
        createLists([directory]),
        createCheck(directory, { root: { outcome: 'blocked', status: 403 }, answer: { verdict: 'INCONCLUSIVE' } }),
      ).directories[0].unreachableSince,
    ).toBeNull()
  })

  test('moves a directory the review found inactive, on a quote found in what was read', () => {
    const directory = createDirectory('tools')
    const answer = {
      verdict: 'INACTIVE',
      inactiveReason: 'NO_SUBMISSION',
      evidence: { quote: QUOTE, url: directory.rootUrl },
    } as const

    const moved = apply(createLists([directory]), createCheck(directory, { answer }))

    expect(moved.inactiveDirectories).toEqual([{ ...directory, lastChecked: TODAY, inactiveReason: 'NO_SUBMISSION' }])
    expect(moved.outcome.result).toBe('movedToInactive')

    const unquoted = apply(
      createLists([directory]),
      createCheck(directory, {
        answer: { ...answer, evidence: { quote: 'We closed submissions forever', url: directory.rootUrl } },
      }),
    )

    expect(unquoted.inactiveDirectories).toEqual([])
    expect(unquoted.outcome).toMatchObject({
      result: 'inconclusive',
      notes: expect.stringContaining('without a quote'),
    })
  })

  test('never takes the page its scripts draw that a quote is on for one lacking a way to submit', () => {
    const directory = createDirectory('tools')
    const submit = 'https://tools.example/submit'
    const answer = {
      verdict: 'INACTIVE',
      inactiveReason: 'BROKEN_SUBMISSION',
      evidence: { quote: 'Submit your tool here', url: submit },
    } as const

    // The home page reads well, and the page quoted is a shell its scripts fill
    const shell = apply(
      createLists([directory]),
      createCheck(directory, { answer, fetchedPages: [{ url: submit, text: 'Submit your tool here' }] }),
    )

    expect(shell.inactiveDirectories).toEqual([])
    expect(shell.outcome).toMatchObject({ result: 'inconclusive', notes: expect.stringContaining('scripts draw') })

    // The home page is a shell, and the page quoted reads well
    const page = apply(
      createLists([directory]),
      createCheck(directory, {
        root: { text: '', isClientRendered: true },
        answer: { ...answer, evidence: { quote: 'The submit form is broken for now', url: submit } },
        fetchedPages: [{ url: submit, text: `${'Our directory. '.repeat(30)}The submit form is broken for now.` }],
      }),
    )

    expect(page.outcome.result).toBe('movedToInactive')
  })

  test('brings an inactive directory back once a startup can be submitted there again', () => {
    const directory = createInactiveDirectory('back', { unreachableSince: '2026-09-01' })
    const { directories, inactiveDirectories, outcome } = apply(
      createLists([], [directory]),
      createCheck(directory, { answer: {} }),
    )
    const { inactiveReason: _reason, ...fields } = directory

    expect(inactiveDirectories).toEqual([])
    expect(directories).toEqual([
      {
        ...fields,
        description: createAnswer().description!,
        categories: [DirectoryCategory.ANY_STARTUP],
        lastChecked: TODAY,
        unreachableSince: null,
      },
    ])
    expect(outcome.result).toBe('movedToActive')
  })

  test('keeps an inactive directory still unreachable where it is, dated', () => {
    const directory = createInactiveDirectory('gone')
    const { inactiveDirectories, outcome } = apply(
      createLists([], [directory]),
      createCheck(directory, { root: UNREACHABLE }),
    )

    expect(inactiveDirectories).toEqual([{ ...directory, lastChecked: TODAY }])
    expect(outcome.result).toBe('inactive')
  })

  test('only dates a check that told nothing, and leaves one the API failed', () => {
    const directory = createDirectory('tools')

    expect(apply(createLists([directory]), createCheck(directory, { answer: 'unanswered' }))).toMatchObject({
      directories: [{ ...directory, lastChecked: TODAY }],
      outcome: { result: 'inconclusive', notes: 'Refused' },
    })
    expect(apply(createLists([directory]), createCheck(directory, { answer: 'failed' }))).toMatchObject({
      directories: [directory],
      outcome: { result: 'notChecked', notes: 'Overloaded' },
    })
  })

  test('follows a redirect within the site, and never one off it', () => {
    const directory = createDirectory('tools', {
      rootUrl: 'http://tools.example/',
      submissionUrl: 'http://tools.example/submit?ref=list',
    })

    expect(
      apply(
        createLists([directory]),
        createCheck(directory, { root: { finalUrl: 'https://www.tools.example/home' }, answer: {} }),
      ).directories[0],
    ).toMatchObject({
      rootUrl: 'https://www.tools.example/',
      submissionUrl: 'https://www.tools.example/submit?ref=list',
    })
    expect(
      apply(
        createLists([directory]),
        createCheck(directory, { root: { finalUrl: 'https://casino.example/' }, answer: {} }),
      ).directories[0],
    ).toMatchObject({ rootUrl: 'http://tools.example/' })
  })

  test('leaves a directory somebody changed while it was checked', () => {
    const directory = createDirectory('tools')
    const changed = { ...directory, rootUrl: 'https://tools.example.org/' }
    const { directories, outcome } = apply(createLists([changed]), createCheck(directory, { answer: {} }))

    expect(directories).toEqual([changed])
    expect(outcome).toMatchObject({
      result: 'notChecked',
      notes: expect.stringContaining('Changed while it was checked'),
    })
  })

  test('finds a directory renamed while it was checked by its id, and leaves it', () => {
    const directory = createDirectory('tools')
    const renamed = { ...directory, name: 'Tools' }
    const { directories, outcome } = apply(createLists([renamed]), createCheck(directory, { answer: {} }))

    expect(directories).toEqual([renamed])
    expect(outcome).toMatchObject({
      name: 'Tools',
      result: 'notChecked',
      notes: expect.stringContaining('Changed while it was checked'),
    })
  })

  test('leaves a directory no longer in either list', () => {
    const { directories, outcome } = apply(createLists([]), createCheck(createDirectory('renamed'), { answer: {} }))

    expect(directories).toEqual([])
    expect(outcome.result).toBe('notChecked')
  })
})
