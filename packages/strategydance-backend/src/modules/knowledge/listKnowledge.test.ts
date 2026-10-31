import { afterAll, describe, expect, it, mock } from 'bun:test'

import {
  compareKnowledgeNames,
  DIRECTORIES,
  DirectoryBusinessModel,
  INACTIVE_DIRECTORIES,
  MARKETING_TACTICS,
  STRATEGIC_FRAMEWORKS,
} from 'strategydance-knowledge'

import type { ModuleCaller } from '~types'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createModuleTestKit } = await import('~modules/testing/createModuleTestKit')

const CALLER: ModuleCaller = {
  kind: 'agent',
  userId: 'member',
  organizationId: '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f',
  membershipCreatedAt: '2026-10-09T10:00:00.000000Z',
  scopes: ['knowledge:read', 'knowledge:write'],
  idempotencyScope: 'conversation:checked',
}

const kit = await createModuleTestKit('knowledge', CALLER)

type Row = { id: string; name: string } & Record<string, unknown>
type Page = { kind: string; items: Row[]; total: number; cursor?: string }

afterAll(() => kit.close())

// Every page of a list, each with the length of the text the tool answered
async function readPages(filters: Record<string, unknown>) {
  const pages: (Page & { length: number })[] = []
  let cursor: string | undefined

  do {
    const result = await kit.call('list_knowledge', { ...filters, ...(cursor && { cursor }) })
    const [content] = result.content as { text: string }[]

    if (result.isError) throw new Error(`list_knowledge refused: ${content!.text}`)

    const page = result.structuredContent as Page

    pages.push({ ...page, length: content!.text.length })
    cursor = page.cursor
  } while (cursor)

  return pages
}

async function readRows(filters: Record<string, unknown>) {
  return (await readPages(filters)).flatMap(page => page.items)
}

describe('list_knowledge', () => {
  it("lists each kind's rows by name, with their kind's fields alone", async () => {
    const frameworks = await readPages({ kind: 'STRATEGIC_FRAMEWORK' })
    const tactics = await readPages({ kind: 'MARKETING_TACTIC' })
    const directories = await readRows({ kind: 'DIRECTORY' })

    expect(frameworks).toHaveLength(1)
    expect(frameworks[0]!.items.map(row => row.id)).toEqual(STRATEGIC_FRAMEWORKS.map(({ id }) => id))
    expect(frameworks[0]!.items.every(row => Object.keys(row).join() === 'id,name,description')).toBe(true)
    expect(tactics).toHaveLength(1)
    expect(tactics[0]!.items.map(row => row.id)).toEqual(MARKETING_TACTICS.map(({ id }) => id))
    expect(
      tactics[0]!.items.every(
        row => Object.keys(row).join() === 'id,name,description,channel,effort,paid,timeToResults,technical',
      ),
    ).toBe(true)
    expect(directories.map(row => row.id)).toEqual(DIRECTORIES.map(({ id }) => id))
    expect(
      directories.every(row => Object.keys(row).join() === 'id,name,description,type,categories,businessModel'),
    ).toBe(true)

    for (const rows of [frameworks[0]!.items, tactics[0]!.items, directories]) {
      expect(rows).toEqual(rows.toSorted(compareKnowledgeNames))
    }
  })

  it('pages the 532 directories within 40000 characters, each once, the inactive ones on none', async () => {
    const pages = await readPages({ kind: 'DIRECTORY' })
    const ids = pages.flatMap(page => page.items.map(row => row.id))
    const inactive = new Set(INACTIVE_DIRECTORIES.map(({ id }) => id))

    expect(DIRECTORIES).toHaveLength(532)
    expect(pages.length).toBeGreaterThan(1)
    expect(pages.every(page => page.length <= 40000 && page.total === 532)).toBe(true)
    expect(ids).toHaveLength(532)
    expect(new Set(ids).size).toBe(532)
    expect(ids.some(id => inactive.has(id))).toBe(false)
  })

  it('keeps the items whose name or description holds every word of the query, whatever their case', async () => {
    const swot = await readPages({ kind: 'STRATEGIC_FRAMEWORK', query: 'Swot STRENGTHS' })
    const framework = STRATEGIC_FRAMEWORKS.find(({ id }) => id === 'swot-analysis')!

    // One word in the name alone, the other in the description alone
    expect(framework.name.toLowerCase()).toContain('swot')
    expect(framework.description.toLowerCase()).not.toContain('swot')
    expect(framework.name.toLowerCase()).not.toContain('strengths')
    expect(framework.description.toLowerCase()).toContain('strengths')
    expect(swot.map(page => page.items.map(row => row.id))).toEqual([['swot-analysis', 'tows-matrix']])
    expect(swot[0]!.total).toBe(2)
    expect(await readRows({ kind: 'STRATEGIC_FRAMEWORK', query: 'swot zeppelin' })).toEqual([])
  })

  it('keeps the directories with one of the categories, and one of the business models, given', async () => {
    const categories = ['DEVELOPER_TOOLS', 'MCP_SERVERS']
    const models = ['FREE', 'FREE_WITH_BADGE']
    const byCategory = await readRows({ kind: 'DIRECTORY', categories })
    const byModel = await readRows({ kind: 'DIRECTORY', businessModels: models })
    const byBoth = await readRows({ kind: 'DIRECTORY', categories, businessModels: models })
    const isListed = ({ categories: listed }: { categories: string[] }) =>
      listed.some(category => categories.includes(category))

    expect(byCategory.map(row => row.id)).toEqual(DIRECTORIES.filter(isListed).map(({ id }) => id))
    expect(byCategory.length).toBeGreaterThan(1)
    expect(byModel.map(row => row.id)).toEqual(
      DIRECTORIES.filter(({ businessModel }) => models.includes(businessModel)).map(({ id }) => id),
    )
    expect(byModel.length).toBeGreaterThan(1)
    expect(byBoth.map(row => row.id)).toEqual(
      DIRECTORIES.filter(directory => isListed(directory) && models.includes(directory.businessModel)).map(
        ({ id }) => id,
      ),
    )
  })

  it('refuses a filter of directories given with another kind, naming the kind it is for', async () => {
    expect(await kit.refusal('list_knowledge', { kind: 'MARKETING_TACTIC', categories: ['SAAS'] })).toBe(
      '`categories` keeps directories alone. List the DIRECTORY kind to filter by it, or leave it out.',
    )
    expect(await kit.refusal('list_knowledge', { kind: 'STRATEGIC_FRAMEWORK', businessModels: ['FREE'] })).toBe(
      '`businessModels` keeps directories alone. List the DIRECTORY kind to filter by it, or leave it out.',
    )
  })

  it('refuses a cursor read under another kind, query or filters, and carries one under the same ones on', async () => {
    const REFUSED = 'That cursor is not one this tool gave for this kind, query and filters. Start again without it.'
    const first = await kit.answer<Page>('list_knowledge', { kind: 'DIRECTORY' })
    const cursor = first.cursor!

    expect(await kit.refusal('list_knowledge', { kind: 'DIRECTORY', query: 'ai', cursor })).toBe(REFUSED)
    expect(await kit.refusal('list_knowledge', { kind: 'DIRECTORY', categories: ['SAAS'], cursor })).toBe(REFUSED)
    expect(await kit.refusal('list_knowledge', { kind: 'MARKETING_TACTIC', cursor })).toBe(REFUSED)
    expect(await kit.refusal('list_knowledge', { kind: 'DIRECTORY', cursor: 'made-up' })).toBe(REFUSED)
    expect((await kit.answer<Page>('list_knowledge', { kind: 'DIRECTORY', cursor })).items[0]!.id).toBe(
      DIRECTORIES[first.items.length]!.id,
    )

    // Every business model, which keeps every directory, given in two orders: the same filters
    const models = Object.values(DirectoryBusinessModel)
    const byModel = await kit.answer<Page>('list_knowledge', { kind: 'DIRECTORY', businessModels: models })
    const carried = await kit.answer<Page>('list_knowledge', {
      kind: 'DIRECTORY',
      businessModels: models.toReversed(),
      cursor: byModel.cursor,
    })

    expect(carried.items[0]!.id).toBe(DIRECTORIES[byModel.items.length]!.id)
  })
})
