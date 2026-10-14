import { describe, expect, it } from 'bun:test'

import { IntegrationAuthentication, IntegrationConnectionStatus } from 'strategydance-database/web'

import getConversationIntegrationIssue from '~utils/conversation/getConversationIntegrationIssue'

const STRIPE = { id: 'stripe', isEnabled: true, authentication: IntegrationAuthentication.API_KEY }
const LINEAR = { id: 'linear', isEnabled: true, authentication: IntegrationAuthentication.OAUTH }

describe('getConversationIntegrationIssue', () => {
  it('finds nothing wrong with a server that works for the reader', () => {
    expect(getConversationIntegrationIssue('stripe', [STRIPE], [])).toBeNull()
    expect(
      getConversationIntegrationIssue(
        'linear',
        [LINEAR],
        [{ integrationId: 'linear', status: IntegrationConnectionStatus.CONNECTED }],
      ),
    ).toBeNull()
  })

  it('says a server gone from the list is missing, by its id rather than its name', () => {
    expect(getConversationIntegrationIssue(null, [STRIPE], [])).toBe('missing')
    expect(getConversationIntegrationIssue('stripe-before', [STRIPE], [])).toBe('missing')
  })

  it('says a server turned off is off, whatever the reader connected', () => {
    expect(getConversationIntegrationIssue('stripe', [{ ...STRIPE, isEnabled: false }], [])).toBe('off')
  })

  it('says an OAuth server is not connected for a reader who has no account there, or one it no longer takes', () => {
    expect(getConversationIntegrationIssue('linear', [LINEAR], [])).toBe('notConnected')
    expect(
      getConversationIntegrationIssue(
        'linear',
        [LINEAR],
        [{ integrationId: 'linear', status: IntegrationConnectionStatus.NEEDS_AUTHENTICATION }],
      ),
    ).toBe('notConnected')
  })
})
