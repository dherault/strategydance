import { describe, expect, it, mock } from 'bun:test'
import { createHash } from 'node:crypto'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: connectConversationModules } = await import('./connectConversationModules')
const { default: buildConversationTools } = await import('./buildConversationTools')

// What a strict tool takes of a request, all its strict tools together (Claude's structured outputs)
const MAX_STRICT_TOOLS = 20
const MAX_OPTIONAL_PARAMETERS = 24
const MAX_UNION_PARAMETERS = 16

// The keywords a strict schema refuses, which the conversion drops
const REFUSED_KEYWORDS = ['$schema', 'minLength', 'maxLength', 'minimum', 'maximum', 'maxItems', 'multipleOf']

type Schema = Record<string, unknown>

// The tools a run's requests send, the modules listed through their own handlers, as a worker lists them
async function readTools() {
  const organizationId = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
  const modules = await connectConversationModules({
    organizationId,
    userId: 'member',
    conversationId: '1a2b3c4d5e6f40718293a4b5c6d7e8f9',
    runId: 'run',
    attempts: 1,
    membershipCreatedAt: fake.addMember('member', organizationId),
  })

  await modules.close()

  return buildConversationTools(modules.tools)
}

// A tool's name, which every tool the agent sends has
function readName(tool: Awaited<ReturnType<typeof readTools>>[number]) {
  return 'name' in tool ? tool.name : tool.type
}

// Every schema in a tool's input schema, itself included
function collectSchemas(schema: Schema): Schema[] {
  const nested = [
    ...Object.values((schema.properties as Record<string, Schema> | undefined) ?? {}),
    ...(schema.items ? [schema.items as Schema] : []),
    ...((schema.anyOf as Schema[] | undefined) ?? []),
  ]

  return [schema, ...nested.flatMap(collectSchemas)]
}

// The parameters of a schema a strict tool counts: those its objects leave out of `required`, and
// those that may take more than one type
function countParameters(schema: Schema) {
  let optional = 0
  let union = 0

  for (const object of collectSchemas(schema)) {
    const properties = Object.entries((object.properties as Record<string, Schema> | undefined) ?? {})
    const required = (object.required as string[] | undefined) ?? []

    optional += properties.filter(([name]) => !required.includes(name)).length
    union += properties.filter(([, property]) => property.anyOf || Array.isArray(property.type)).length
  }

  return { optional, union }
}

describe('buildConversationTools', () => {
  /*
    Its bytes, like the system prompt's, are what every conversation's history was made with, so a
    change to them makes every existing conversation lose its earlier reasoning once: a module's
    tools changing, or an SDK or zod release writing their schemas otherwise. Change this hash only
    with a release that means to change the tools
  */
  it('keeps its bytes, the agent’s own tools then the Knowledge module’s', async () => {
    const tools = await readTools()

    expect(tools.map(readName)).toEqual([
      'web_search',
      'ask_user',
      'search_documents',
      'list_documents',
      'read_document',
      'create_document',
      'update_document',
      'set_document_aspects',
      'delete_document',
      'restore_document',
    ])
    expect(createHash('sha256').update(JSON.stringify(tools)).digest('hex')).toBe(
      'e656823a0d211e54f3fa29240480c688533f5fe019ef2960f3bfe1f2ebc2bb45',
    )
  })

  it('names each tool once, as Claude takes a tool name', async () => {
    const names = (await readTools()).map(readName)

    expect(new Set(names).size).toBe(names.length)

    for (const name of names) expect(name).toMatch(/^[a-zA-Z0-9_-]{1,128}$/)
  })

  it('sends every tool of Strategy Dance’s strict and streamed, within what strict tools take', async () => {
    const strict = (await readTools()).filter(tool => 'input_schema' in tool)
    let optional = 0
    let union = 0

    expect(strict.length).toBeLessThanOrEqual(MAX_STRICT_TOOLS)

    for (const tool of strict) {
      expect(tool).toMatchObject({ strict: true, eager_input_streaming: true })

      const schema = tool.input_schema as Schema

      for (const object of collectSchemas(schema)) {
        for (const keyword of REFUSED_KEYWORDS) expect(object).not.toHaveProperty(keyword)

        if (object.type === 'object') expect(object.additionalProperties).toBe(false)
      }

      const counted = countParameters(schema)

      optional += counted.optional
      union += counted.union
    }

    expect(optional).toBeLessThanOrEqual(MAX_OPTIONAL_PARAMETERS)
    expect(union).toBeLessThanOrEqual(MAX_UNION_PARAMETERS)
  })
})
