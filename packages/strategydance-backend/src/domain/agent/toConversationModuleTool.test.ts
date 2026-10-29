import { describe, expect, it } from 'bun:test'

import type { Tool } from '@modelcontextprotocol/client'

import toConversationModuleTool from './toConversationModuleTool'

describe('toConversationModuleTool', () => {
  it('makes a streamed Claude tool of a module’s tool, not strict, its name and description kept', () => {
    expect(
      toConversationModuleTool({
        name: 'read_document',
        title: 'Read a document',
        description: 'Reads a document',
        inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        annotations: { readOnlyHint: true },
      }),
    ).toEqual({
      name: 'read_document',
      description: 'Reads a document',
      input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      eager_input_streaming: true,
    })
  })

  it('keeps the schema as the module wrote it, bounds, patterns and formats included, but its dialect', () => {
    const properties: NonNullable<Tool['inputSchema']['properties']> = {
      name: { type: 'string', minLength: 1, maxLength: 120, pattern: '^[^\\r\\n]*$' },
      limit: { type: 'integer', minimum: 1, maximum: 10 },
      dueDate: { anyOf: [{ type: 'string', format: 'date' }, { type: 'null' }] },
      aspects: { type: 'array', items: { type: 'string', enum: ['SALES'] }, maxItems: 4 },
      range: { type: 'object', properties: { from: { type: 'string' } }, additionalProperties: false },
    }

    expect(
      toConversationModuleTool({
        name: 'update_task',
        inputSchema: {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          type: 'object',
          properties,
          required: ['name'],
        },
      }),
    ).toEqual({
      name: 'update_task',
      description: '',
      input_schema: { type: 'object', properties, required: ['name'] },
      eager_input_streaming: true,
    })
  })
})
