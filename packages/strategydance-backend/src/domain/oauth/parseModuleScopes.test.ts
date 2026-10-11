import { describe, expect, test } from 'bun:test'

import { MODULES } from 'strategydance-core'

import parseModuleScopes from './parseModuleScopes'

const [knowledge] = MODULES

describe('parseModuleScopes', () => {
  test('asks for read and write when no scope is named', () => {
    expect(parseModuleScopes(knowledge, undefined)).toEqual(['knowledge:read', 'knowledge:write'])
    expect(parseModuleScopes(knowledge, '')).toEqual(['knowledge:read', 'knowledge:write'])
  })

  test('takes read alone, or read and write in either order, once each', () => {
    expect(parseModuleScopes(knowledge, 'knowledge:read')).toEqual(['knowledge:read'])
    expect(parseModuleScopes(knowledge, 'knowledge:write knowledge:read')).toEqual([
      'knowledge:read',
      'knowledge:write',
    ])
    expect(parseModuleScopes(knowledge, 'knowledge:read  knowledge:read')).toEqual(['knowledge:read'])
  })

  test("refuses write without read, and any scope past the module's", () => {
    for (const scope of [
      'knowledge:write',
      'knowledge:read tasks:read',
      'knowledge:read offline_access',
      'tasks:read',
    ]) {
      expect(parseModuleScopes(knowledge, scope)).toBeNull()
    }
  })
})
