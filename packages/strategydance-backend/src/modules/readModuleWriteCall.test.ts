import { describe, expect, it } from 'bun:test'

import type { ServerContext } from '@modelcontextprotocol/server'

import type { ModuleCaller } from '~types'

import { MODULE_IDEMPOTENCY_KEY_META } from '~constants'

import readModuleWriteCall from '~modules/readModuleWriteCall'
import toToolRefusal from '~modules/toToolRefusal'

const READ_ONLY = toToolRefusal('This connection may only read.')

const caller: ModuleCaller = {
  kind: 'external',
  userId: 'member',
  organizationId: '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f',
  membershipCreatedAt: '2026-10-11T10:00:00.000000Z',
  scopes: ['documents:read'],
  idempotencyScope: 'connection:checked',
}

function serverContext(meta: Record<string, unknown> = {}) {
  return { mcpReq: { _meta: meta } } as unknown as ServerContext
}

describe('readModuleWriteCall', () => {
  it("refuses a caller without the write scope, the guard behind the tool's scope challenge, before reading its key", () => {
    expect(
      readModuleWriteCall(
        caller,
        { scope: 'documents:write', readOnly: READ_ONLY },
        serverContext({ [MODULE_IDEMPOTENCY_KEY_META]: '' }),
        'create_document',
        {},
      ),
    ).toEqual({ outcome: 'refused', result: READ_ONLY })
  })

  it('reads the key of a caller who may write', () => {
    const read = readModuleWriteCall(
      { ...caller, scopes: ['documents:read', 'documents:write'] },
      { scope: 'documents:write', readOnly: READ_ONLY },
      serverContext({ [MODULE_IDEMPOTENCY_KEY_META]: 'key' }),
      'create_document',
      { title: 'New' },
    )

    expect(read).toMatchObject({ outcome: 'ready', call: { key: 'key', tool: 'create_document' } })
  })
})
