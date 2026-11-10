import { describe, expect, it } from 'bun:test'

import type { Directory } from 'strategydance-knowledge/src/directories/types'

import type { DirectoryState } from '~types'

import filterDirectories, { type DirectoryFilters } from '~utils/directory/filterDirectories'

function directory(fields: Partial<Directory> & { id: string }): Directory {
  return {
    name: fields.id,
    type: 'WEBSITE',
    rootUrl: `https://${fields.id}.example/`,
    submissionUrl: `https://${fields.id}.example/submit`,
    description: '',
    categories: [],
    businessModel: 'FREE',
    lastChecked: null,
    unreachableSince: null,
    ...fields,
  }
}

const NO_FILTERS: DirectoryFilters = { view: 'all', query: '', businessModels: [], categories: [], type: null }

const DIRECTORIES = [
  directory({
    id: 'betalist',
    description: 'Early-stage startups before launch',
    businessModel: 'FREE_WITH_LONG_QUEUE',
  }),
  directory({ id: 'devhunt', categories: ['DEVELOPER_TOOLS'], businessModel: 'PAID' }),
  directory({ id: 'everything', categories: ['ANY_STARTUP'] }),
  directory({ id: 'nordic', categories: ['ANY_STARTUP', 'REGIONAL'] }),
  directory({ id: 'r-sideproject', type: 'REDDIT_COMMUNITY', rootUrl: 'https://www.reddit.com/r/SideProject/' }),
]

const STATES = new Map<string, DirectoryState>([
  ['betalist', { status: 'SUBMITTED', changedAt: '2026-11-01T10:00:00Z', notesText: 'Login: founder@example.com' }],
  ['devhunt', { status: 'LISTED', changedAt: '2026-11-02T10:00:00Z', notesText: null }],
  ['nordic', { status: 'DISMISSED', changedAt: '2026-11-03T10:00:00Z', notesText: null }],
  ['everything', { status: null, changedAt: null, notesText: 'Waiting on their reply' }],
])

function ids(filters: Partial<DirectoryFilters>) {
  return filterDirectories(DIRECTORIES, STATES, { ...NO_FILTERS, ...filters }).map(({ id }) => id)
}

describe('filterDirectories', () => {
  it("keeps a tab's directories, those to do having no status, in the catalogue's order", () => {
    expect(ids({ view: 'todo' })).toEqual(['everything', 'r-sideproject'])
    expect(ids({ view: 'submitted' })).toEqual(['betalist'])
    expect(ids({ view: 'listed' })).toEqual(['devhunt'])
    expect(ids({ view: 'dismissed' })).toEqual(['nordic'])
    expect(ids({})).toEqual(DIRECTORIES.map(({ id }) => id))
  })

  it("matches every word of the search in the name, description, address or the team's notes, case aside", () => {
    expect(ids({ query: 'early LAUNCH' })).toEqual(['betalist'])
    expect(ids({ query: 'reddit.com' })).toEqual(['r-sideproject'])
    expect(ids({ query: 'founder@example' })).toEqual(['betalist'])
    expect(ids({ query: '  their   reply ' })).toEqual(['everything'])
    expect(ids({ query: 'early reply' })).toEqual([])
  })

  it('keeps the pricing and the type asked for', () => {
    expect(ids({ businessModels: ['PAID', 'FREE_WITH_LONG_QUEUE'] })).toEqual(['betalist', 'devhunt'])
    expect(ids({ type: 'REDDIT_COMMUNITY' })).toEqual(['r-sideproject'])
  })

  it('keeps a directory taking any startup under every category but regional, and none the check has not read', () => {
    expect(ids({ categories: ['DEVELOPER_TOOLS'] })).toEqual(['devhunt', 'everything', 'nordic'])
    expect(ids({ categories: ['REGIONAL'] })).toEqual(['nordic'])
    expect(ids({ categories: ['SAAS'] })).not.toContain('betalist')
  })
})
