import { describe, expect, test } from 'bun:test'

import { IntegrationAuthentication } from 'strategydance-database/backend'

import decideConversationIntegrationCall, { SUBAGENT_APPROVAL_REFUSAL } from './decideConversationIntegrationCall'

const INTEGRATION_ID = '7c9e6679742540de944be07fc1f90ae7'
const CALL = { integrationId: INTEGRATION_ID, toolName: 'create_issue', arguments: { query: 'Fix the login' } }

// The server as a call reads it when it is drawn, its tools listed, none running without approval
function found(fields: { isEnabled?: boolean; autoApprovedTools?: string[] } = {}) {
  return {
    outcome: 'found' as const,
    integration: {
      id: INTEGRATION_ID,
      name: 'Issues',
      authentication: IntegrationAuthentication.NONE,
      isEnabled: true,
      configRevision: 2,
      keyGeneration: 0,
      hasKey: false,
      tools: [
        { name: 'list_issues', inputSchema: { type: 'object' }, definitionHash: 'a'.repeat(64) },
        { name: 'create_issue', inputSchema: { type: 'object' }, definitionHash: 'c'.repeat(64) },
      ],
      autoApprovedTools: [],
      ...fields,
    },
    connection: null,
  }
}

const DRAWN = { id: INTEGRATION_ID, name: 'Issues', toolName: 'create_issue' }
const BINDING = { configRevision: 2, toolHash: 'c'.repeat(64), credentialGeneration: null }

describe('decideConversationIntegrationCall', () => {
  test('lets a tool an administrator lets run without approval run, bound to the server as it is', () => {
    for (const isSubagent of [false, true]) {
      expect(
        decideConversationIntegrationCall(found({ autoApprovedTools: ['c'.repeat(64)] }), CALL, { isSubagent }),
      ).toEqual({
        kind: 'run',
        integration: DRAWN,
        binding: BINDING,
      })
    }
  })

  test('has any other call wait for the member’s approval, bound the same', () => {
    expect(decideConversationIntegrationCall(found(), CALL)).toEqual({
      kind: 'approval',
      integration: DRAWN,
      binding: BINDING,
    })
  })

  test('refuses a subagent’s call that would wait for an approval nobody can give it, naming the server', () => {
    expect(decideConversationIntegrationCall(found(), CALL, { isSubagent: true })).toEqual({
      kind: 'refused',
      reason: SUBAGENT_APPROVAL_REFUSAL,
      integration: DRAWN,
    })
  })

  test('refuses a call the member cannot make, whoever makes it, before any approval', () => {
    for (const isSubagent of [false, true]) {
      expect(decideConversationIntegrationCall(found({ isEnabled: false }), CALL, { isSubagent })).toMatchObject({
        kind: 'refused',
        reason: expect.stringContaining('Issues is turned off'),
        integration: DRAWN,
      })
      expect(decideConversationIntegrationCall({ outcome: 'unknown' }, CALL, { isSubagent })).toMatchObject({
        kind: 'refused',
        integration: null,
      })
    }
  })
})
