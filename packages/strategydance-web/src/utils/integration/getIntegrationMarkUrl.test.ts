import { describe, expect, test } from 'bun:test'
import { readdirSync } from 'node:fs'
import path from 'node:path'

import { EXTERNAL_MCP_SERVERS } from 'strategydance-external-mcp-servers'

import getIntegrationMarkUrl from './getIntegrationMarkUrl'

const MARKS_DIRECTORY = path.resolve(import.meta.dir, '../../../public/assets/images/mcp')

describe('getIntegrationMarkUrl', () => {
  test('serves the mark of every external MCP server that has one, and no other', () => {
    const files = readdirSync(MARKS_DIRECTORY).toSorted()
    const marked = EXTERNAL_MCP_SERVERS.filter(server => server.hasMark).map(server => `${server.slug}.svg`)

    expect(files).toEqual(marked.toSorted())

    for (const server of EXTERNAL_MCP_SERVERS) {
      expect(getIntegrationMarkUrl(server.slug)).toBe(server.hasMark ? `/assets/images/mcp/${server.slug}.svg` : null)
    }
  })

  test('has no mark for a server added by its address', () => {
    expect(getIntegrationMarkUrl(null)).toBeNull()
    expect(getIntegrationMarkUrl('nothing-of-the-kind')).toBeNull()
  })
})
