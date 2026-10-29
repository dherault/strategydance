import { describe, expect, test } from 'bun:test'

import parseModuleResource from './parseModuleResource'

// The tests run as neither development nor production, under the development backend's issuer
describe('parseModuleResource', () => {
  test("names a module by its address under the issuer, in the address's one form", () => {
    expect(parseModuleResource('http://localhost:3003/mcp/documents')).toEqual({
      module: expect.objectContaining({ name: 'documents' }),
      resource: 'http://localhost:3003/mcp/documents',
    })
    expect(parseModuleResource('HTTP://LOCALHOST:3003/mcp/tasks')).toEqual({
      module: expect.objectContaining({ name: 'tasks' }),
      resource: 'http://localhost:3003/mcp/tasks',
    })
    expect(parseModuleResource('http://localhost:3003/mcp/budget')).toEqual({
      module: expect.objectContaining({ name: 'budget' }),
      resource: 'http://localhost:3003/mcp/budget',
    })
  })

  test('refuses anything else', () => {
    for (const value of [
      undefined,
      '',
      'not an address',
      'http://localhost:3003/mcp/unknown',
      // A module served to no external agent
      'http://localhost:3003/mcp/subagents',
      'http://localhost:3003/mcp/documents/',
      'http://localhost:3003/mcp/documents?x=1',
      'http://localhost:3003/mcp/documents?',
      'http://localhost:3003/mcp/documents#part',
      'http://user@localhost:3003/mcp/documents',
      'https://localhost:3003/mcp/documents',
      'http://localhost:3004/mcp/documents',
      'https://api.strategydance.com/mcp/documents',
      'http://localhost:3003/MCP/documents',
      'http://local\nhost:3003/mcp/documents',
      'http://localhost:3003/mcp/docu\tments',
      ' http://localhost:3003/mcp/documents',
    ]) {
      expect(parseModuleResource(value)).toBeNull()
    }
  })
})
