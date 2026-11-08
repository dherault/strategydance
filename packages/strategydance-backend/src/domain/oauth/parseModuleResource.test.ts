import { describe, expect, test } from 'bun:test'

import parseModuleResource from './parseModuleResource'

// The tests run as neither development nor production, under the development backend's issuer
describe('parseModuleResource', () => {
  test("names the one address by its path under the issuer, with every served module, in `MODULES`' order", () => {
    const target = parseModuleResource('http://localhost:3003/mcp')

    expect(target?.address.name).toBe('strategydance')
    expect(target?.modules.map(({ name }) => name)).toEqual(['documents', 'tasks', 'budget'])
    expect(target?.resource).toBe('http://localhost:3003/mcp')
    expect(parseModuleResource('HTTP://LOCALHOST:3003/mcp')?.resource).toBe('http://localhost:3003/mcp')
  })

  test("names a module's own address with its module alone, in the address's one form", () => {
    for (const name of ['documents', 'tasks', 'budget'] as const) {
      const target = parseModuleResource(`HTTP://LOCALHOST:3003/mcp/${name}`)

      expect(target?.address.name).toBe(name)
      expect(target?.modules.map(module => module.name)).toEqual([name])
      expect(target?.resource).toBe(`http://localhost:3003/mcp/${name}`)
    }
  })

  test('refuses anything else', () => {
    for (const value of [
      undefined,
      '',
      'not an address',
      'http://localhost:3003',
      'http://localhost:3003/',
      'http://localhost:3003/mcp/',
      'http://localhost:3003/mcp?x=1',
      'http://localhost:3003/mcp#part',
      'http://localhost:3003/MCP',
      'https://api.strategydance.com/mcp',
      'http://localhost:3003/mcp/unknown',
      // A module served to no external agent
      'http://localhost:3003/mcp/subagents',
      'http://localhost:3003/mcp/knowledge',
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
