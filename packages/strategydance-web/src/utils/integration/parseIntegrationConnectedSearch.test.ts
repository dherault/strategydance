import { describe, expect, test } from 'bun:test'

import parseIntegrationConnectedSearch from './parseIntegrationConnectedSearch'

const ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7'

describe('parseIntegrationConnectedSearch', () => {
  test('reads what the callback sends', () => {
    expect(
      parseIntegrationConnectedSearch({ outcome: 'received', organization: ID, integration: ID, authorization: ID }),
    ).toEqual({ outcome: 'received', organization: ID, integration: ID, authorization: ID })
  })

  test('writes every key, undefined for one that is not what it should be', () => {
    expect(
      parseIntegrationConnectedSearch({
        outcome: 'connected',
        organization: ID.replaceAll('-', ''),
        integration: 7,
        authorization: `${ID}?next=https://elsewhere.example.com`,
      }),
    ).toEqual({ outcome: undefined, organization: undefined, integration: undefined, authorization: undefined })
  })

  test('reads a refusal without ids', () => {
    expect(parseIntegrationConnectedSearch({ outcome: 'failed' })).toEqual({
      outcome: 'failed',
      organization: undefined,
      integration: undefined,
      authorization: undefined,
    })
  })
})
