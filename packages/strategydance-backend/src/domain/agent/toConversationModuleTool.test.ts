import { describe, expect, it } from 'bun:test'

import type { Tool } from '@modelcontextprotocol/client'

import toConversationModuleTool from './toConversationModuleTool'

describe('toConversationModuleTool', () => {
  it('makes a strict, streamed Claude tool of a module’s tool, its name and description kept', () => {
    expect(
      toConversationModuleTool({
        name: 'read_document',
        title: 'Read knowledge',
        description: 'Reads a document',
        inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        annotations: { readOnlyHint: true },
      }),
    ).toEqual({
      name: 'read_document',
      description: 'Reads a document',
      input_schema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
      strict: true,
      eager_input_streaming: true,
    })
  })

  it('drops the bounds a strict schema refuses, at every depth, and keeps a property named like one', () => {
    const { input_schema: schema } = toConversationModuleTool({
      name: 'search_documents',
      inputSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          query: { type: 'string', minLength: 1, maxLength: 100, pattern: '^[^\\r\\n]*$' },
          limit: { type: 'integer', minimum: 1, maximum: 10, exclusiveMinimum: 0, multipleOf: 1 },
          minimum: { type: 'array', items: { type: 'string', maxLength: 5 }, minItems: 2, maxItems: 4 },
          aspects: { type: 'array', items: { type: 'string', enum: ['SALES'] }, minItems: 1 },
          range: { type: 'object', properties: { from: { type: 'string', minLength: 1 } } },
        },
        required: ['query'],
      },
    })

    expect(schema).toEqual({
      type: 'object',
      properties: {
        query: { type: 'string', pattern: '^[^\\r\\n]*$' },
        limit: { type: 'integer' },
        minimum: { type: 'array', items: { type: 'string' } },
        aspects: { type: 'array', items: { type: 'string', enum: ['SALES'] }, minItems: 1 },
        range: { type: 'object', properties: { from: { type: 'string' } }, additionalProperties: false },
      },
      required: ['query'],
      additionalProperties: false,
    })
  })

  it('refuses what a strict schema refuses rather than drop it', () => {
    const tool = (property: NonNullable<Tool['inputSchema']['properties']>[string]): Tool => ({
      name: 'checked',
      inputSchema: { type: 'object', properties: { property } },
    })

    expect(() => toConversationModuleTool(tool({ type: 'object', additionalProperties: { type: 'string' } }))).toThrow(
      'takes properties it does not name',
    )
    expect(() => toConversationModuleTool(tool({ oneOf: [{ type: 'string' }] }))).toThrow('the keyword oneOf')
    expect(() => toConversationModuleTool(tool({ type: 'string', format: 'phone' }))).toThrow('the format phone')
  })
})
