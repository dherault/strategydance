import { describe, expect, it } from 'bun:test'

import readAgentConnectionAccess from './readAgentConnectionAccess'

describe('readAgentConnectionAccess', () => {
  it("lists each module a connection at the one address holds, in `MODULES`' order, and none it does not", () => {
    expect(
      readAgentConnectionAccess({
        module: 'strategydance',
        scopes: ['tasks:read', 'documents:read', 'documents:write'],
      }),
    ).toEqual({
      kind: 'address',
      modules: [
        { name: 'documents', isWrite: true },
        { name: 'tasks', isWrite: false },
      ],
    })
  })

  it("names a module's own address's module, and a module served at no address any more", () => {
    expect(readAgentConnectionAccess({ module: 'tasks', scopes: ['tasks:read', 'tasks:write'] })).toEqual({
      kind: 'module',
      name: 'tasks',
      isWrite: true,
    })
    expect(readAgentConnectionAccess({ module: 'knowledge', scopes: ['knowledge:read'] })).toEqual({
      kind: 'module',
      name: 'knowledge',
      isWrite: false,
    })
  })

  it('names an address it does not know as it is', () => {
    expect(readAgentConnectionAccess({ module: 'retired', scopes: ['retired:read'] })).toEqual({
      kind: 'unknown',
      name: 'retired',
    })
  })
})
