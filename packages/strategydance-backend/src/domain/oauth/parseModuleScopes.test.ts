import { describe, expect, test } from 'bun:test'

import { MODULES, SERVED_MODULES } from 'strategydance-core'

import parseModuleScopes from './parseModuleScopes'

const documents = MODULES.filter(({ name }) => name === 'documents')

describe('parseModuleScopes', () => {
  describe("at a module's own address", () => {
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

  describe('at the one address', () => {
    test("asks for every module's read and write when no scope is named", () => {
      expect(parseModuleScopes(SERVED_MODULES, undefined)).toEqual([
        'documents:read',
        'documents:write',
        'tasks:read',
        'tasks:write',
        'budget:read',
        'budget:write',
      ])
    })

    test("takes each module's read, alone or with its write, or neither, in `MODULES`' order", () => {
      expect(parseModuleScopes(SERVED_MODULES, 'tasks:read documents:read')).toEqual(['documents:read', 'tasks:read'])
      expect(parseModuleScopes(SERVED_MODULES, 'tasks:write budget:read tasks:read')).toEqual([
        'tasks:read',
        'tasks:write',
        'budget:read',
      ])
      expect(parseModuleScopes(SERVED_MODULES, 'budget:read')).toEqual(['budget:read'])
    })

    test('refuses a write without its read, a scope of no served module, and no read at all', () => {
      for (const scope of [
        'tasks:write',
        'documents:read tasks:write',
        'documents:read budget:write',
        'documents:read knowledge:read',
        'documents:read subagents:read',
        'tasks:read offline_access',
        'documents:write tasks:write',
      ]) {
        expect(parseModuleScopes(SERVED_MODULES, scope)).toBeNull()
      }
    })
  })
})
