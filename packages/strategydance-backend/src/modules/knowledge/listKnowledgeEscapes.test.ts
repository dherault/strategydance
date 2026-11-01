import { afterAll, expect, it, mock } from 'bun:test'

import type { KnowledgeEntry, ModuleCaller } from '~types'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

// 200 directories whose every character JSON escapes, in place of the package's
const ITEMS: KnowledgeEntry[] = Array.from({ length: 200 }, (_, index) => ({
  kind: 'DIRECTORY',
  item: {
    id: `directory-${index}`,
    name: '"'.repeat(80),
    type: 'WEBSITE',
    rootUrl: 'https://example.com/',
    submissionUrl: 'https://example.com/',
    description: '\u0001'.repeat(140),
    categories: ['SAAS'],
    businessModel: 'FREE',
    lastChecked: null,
    unreachableSince: null,
  },
}))

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)
mock.module('~domain/knowledge/readKnowledgeCatalogue', () => ({
  default: () => ({ items: ITEMS, inactive: [] }),
}))

const { default: createModuleTestKit } = await import('~modules/testing/createModuleTestKit')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const CALLER: ModuleCaller = {
  kind: 'agent',
  userId: 'member',
  organizationId: ORGANIZATION_ID,
  membershipCreatedAt: fake.addMember('member', ORGANIZATION_ID),
  scopes: ['knowledge:read', 'knowledge:write'],
  idempotencyScope: 'conversation:checked',
}

const kit = await createModuleTestKit('knowledge', CALLER)

afterAll(() => kit.close())

it('cuts a page of directories whose every character JSON escapes short, within 40000 characters', async () => {
  const pages: { ids: string[]; length: number }[] = []
  let cursor: string | undefined

  do {
    const result = await kit.call('list_knowledge', { kind: 'DIRECTORY', ...(cursor && { cursor }) })
    const [content] = result.content as { text: string }[]
    const page = result.structuredContent as { items: { id: string }[]; cursor?: string }

    pages.push({ ids: page.items.map(({ id }) => id), length: content!.text.length })
    cursor = page.cursor
  } while (cursor)

  const ids = pages.flatMap(page => page.ids)

  // Counted unescaped, 200 rows of about 340 characters would fill two pages, and escaped they fill six
  expect(pages.length).toBeGreaterThan(4)
  expect(pages.every(page => page.length <= 40000)).toBe(true)
  expect(ids).toHaveLength(200)
  expect(new Set(ids).size).toBe(200)
})
