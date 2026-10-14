import { describe, expect, it } from 'bun:test'

import { MAX_INTEGRATION_NAME_LENGTH } from 'strategydance-core'

import parseIntegrationsSearch from '~utils/integration/parseIntegrationsSearch'

const ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7'

describe('parseIntegrationsSearch', () => {
  it('reads the server to open, connect or turn on, and the name of one to add', () => {
    expect(parseIntegrationsSearch({ open: ID, connect: ID, enable: ID, add: 'Stripe' })).toEqual({
      open: ID,
      connect: ID,
      enable: ID,
      add: 'Stripe',
    })
  })

  it('writes every key, undefined for one that is not what it should be', () => {
    expect(
      parseIntegrationsSearch({
        open: ID.replaceAll('-', ''),
        connect: 12345,
        enable: 'javascript:alert(1)',
        add: 'a'.repeat(MAX_INTEGRATION_NAME_LENGTH + 1),
      }),
    ).toEqual({ open: undefined, connect: undefined, enable: undefined, add: undefined })
    expect(parseIntegrationsSearch({ add: '  ' })).toEqual({
      open: undefined,
      connect: undefined,
      enable: undefined,
      add: undefined,
    })
  })
})
