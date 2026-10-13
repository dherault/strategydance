import { describe, expect, test } from 'bun:test'

import parseIntegrationTools from './parseIntegrationTools'

describe('parseIntegrationTools', () => {
  test('reads the tools a server listed', () => {
    const tools = [{ name: 'list_issues', inputSchema: { type: 'object' }, definitionHash: 'abc' }]

    expect(parseIntegrationTools(JSON.stringify(tools))).toEqual(tools)
  })

  test('reads nothing from no list, or from what is none', () => {
    expect(parseIntegrationTools(null)).toEqual([])
    expect(parseIntegrationTools('{')).toEqual([])
    expect(parseIntegrationTools('{"name":"x"}')).toEqual([])
    expect(parseIntegrationTools('[{"name":1},{"description":"no name"}]')).toEqual([])
  })
})
