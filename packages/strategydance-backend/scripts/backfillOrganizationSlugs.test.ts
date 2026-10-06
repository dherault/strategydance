import { describe, expect, it } from 'bun:test'

import { MAX_SLUG_ATTEMPTS, backfillOrganizationSlugs } from './backfillOrganizationSlugs'

type Row = { id: string; name: string; slug: string | null }

const TAKEN = new Error('violates SQL unique constraint: organization_slug_uidx')

/*
  The organizations table in memory, answering the script's two operations as Data Connect would:
  the read of those without a slug, and the write that only lands while there is none, refused on
  a slug another row holds
*/
function createDatabase(rows: Row[], options: { beforeWrite?: (id: string) => void; failWrite?: Error } = {}) {
  const writes: { id: string; slug: string }[] = []

  async function execute<Data>(query: string, variables?: Record<string, unknown>): Promise<Data> {
    if (query.includes('ReadOrganizationsWithoutSlug')) {
      return { organizations: rows.filter(row => row.slug === null).map(({ id, name }) => ({ id, name })) } as Data
    }

    const { id, slug } = variables as { id: string; slug: string }

    options.beforeWrite?.(id)

    if (options.failWrite) throw options.failWrite
    if (rows.some(row => row.slug === slug)) throw TAKEN

    const row = rows.find(candidate => candidate.id === id && candidate.slug === null)

    if (!row) return { organization_updateMany: 0 } as Data

    row.slug = slug
    writes.push({ id, slug })

    return { organization_updateMany: 1 } as Data
  }

  return { rows, writes, execute }
}

// Draws the given suffixes in order, so a test chooses which slugs clash
function createSlugs(...suffixes: string[]) {
  let index = 0

  return (name: string) => `${name.toLowerCase()}-${suffixes[index++] ?? 'zzzz'}`
}

describe('backfillOrganizationSlugs', () => {
  it('writes nothing on a dry run, and says what each would get', async () => {
    const database = createDatabase([
      { id: 'a', name: 'Acme', slug: null },
      { id: 'b', name: 'Globex', slug: 'globex-ab12' },
    ])

    const outcomes = await backfillOrganizationSlugs({
      execute: database.execute,
      isApplying: false,
      createSlug: createSlugs('aaaa'),
    })

    expect(outcomes).toEqual([{ id: 'a', kind: 'planned', slug: 'acme-aaaa' }])
    expect(database.writes).toEqual([])
  })

  it('gives each organization without a slug one, and leaves the others', async () => {
    const database = createDatabase([
      { id: 'a', name: 'Acme', slug: null },
      { id: 'b', name: 'Globex', slug: 'globex-ab12' },
      { id: 'c', name: 'Initech', slug: null },
    ])

    const outcomes = await backfillOrganizationSlugs({
      execute: database.execute,
      isApplying: true,
      createSlug: createSlugs('aaaa', 'bbbb'),
    })

    expect(outcomes).toEqual([
      { id: 'a', kind: 'written', slug: 'acme-aaaa' },
      { id: 'c', kind: 'written', slug: 'initech-bbbb' },
    ])
    expect(database.rows.map(row => row.slug)).toEqual(['acme-aaaa', 'globex-ab12', 'initech-bbbb'])
  })

  it('draws again when another organization holds the slug', async () => {
    const database = createDatabase([
      { id: 'a', name: 'Acme', slug: null },
      { id: 'b', name: 'Acme', slug: 'acme-aaaa' },
    ])

    const outcomes = await backfillOrganizationSlugs({
      execute: database.execute,
      isApplying: true,
      createSlug: createSlugs('aaaa', 'aaaa', 'cccc'),
    })

    expect(outcomes).toEqual([{ id: 'a', kind: 'written', slug: 'acme-cccc' }])
  })

  it('gives up on one organization after a few clashes, and goes on with the rest', async () => {
    const database = createDatabase([
      { id: 'a', name: 'Acme', slug: null },
      { id: 'b', name: 'Acme', slug: 'acme-aaaa' },
      { id: 'c', name: 'Globex', slug: null },
    ])

    const outcomes = await backfillOrganizationSlugs({
      execute: database.execute,
      isApplying: true,
      createSlug: createSlugs(...Array.from({ length: MAX_SLUG_ATTEMPTS }, () => 'aaaa'), 'dddd'),
    })

    expect(outcomes[0]).toMatchObject({ id: 'a', kind: 'failed' })
    expect(outcomes[1]).toEqual({ id: 'c', kind: 'written', slug: 'globex-dddd' })
  })

  it('leaves alone an organization somebody gave a slug since the read', async () => {
    const database = createDatabase([{ id: 'a', name: 'Acme', slug: null }], {
      beforeWrite: id => {
        const row = database.rows.find(candidate => candidate.id === id)

        if (row) row.slug = 'acme-mine'
      },
    })

    const outcomes = await backfillOrganizationSlugs({
      execute: database.execute,
      isApplying: true,
      createSlug: createSlugs('aaaa'),
    })

    expect(outcomes).toEqual([{ id: 'a', kind: 'skipped' }])
    expect(database.rows[0]?.slug).toBe('acme-mine')
  })

  it('does not draw again on any other failure', async () => {
    let draws = 0
    const database = createDatabase([{ id: 'a', name: 'Acme', slug: null }], {
      failWrite: new Error('PERMISSION_DENIED'),
    })

    const outcomes = await backfillOrganizationSlugs({
      execute: database.execute,
      isApplying: true,
      createSlug: name => {
        draws++

        return `${name.toLowerCase()}-aaaa`
      },
    })

    expect(outcomes).toEqual([{ id: 'a', kind: 'failed', error: 'PERMISSION_DENIED' }])
    expect(draws).toBe(1)
  })
})
