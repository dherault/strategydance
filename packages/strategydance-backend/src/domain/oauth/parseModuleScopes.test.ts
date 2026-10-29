import { describe, expect, test } from 'bun:test'

import { MODULES } from 'strategydance-core'

import parseModuleScopes from './parseModuleScopes'

const [documents] = MODULES

describe('parseModuleScopes', () => {
  test('asks for read and write when no scope is named', () => {
    expect(parseModuleScopes(documents, undefined)).toEqual(['documents:read', 'documents:write'])
    expect(parseModuleScopes(documents, '')).toEqual(['documents:read', 'documents:write'])
  })

  test('takes read alone, or read and write in either order, once each', () => {
    expect(parseModuleScopes(documents, 'documents:read')).toEqual(['documents:read'])
    expect(parseModuleScopes(documents, 'documents:write documents:read')).toEqual([
      'documents:read',
      'documents:write',
    ])
    expect(parseModuleScopes(documents, 'documents:read  documents:read')).toEqual(['documents:read'])
  })

  test("refuses write without read, and any scope past the module's", () => {
    for (const scope of [
      'documents:write',
      'documents:read tasks:read',
      'documents:read offline_access',
      'tasks:read',
    ]) {
      expect(parseModuleScopes(documents, scope)).toBeNull()
    }
  })
})
