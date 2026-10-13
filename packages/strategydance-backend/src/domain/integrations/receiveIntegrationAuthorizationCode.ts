import { validateAuthorizationResponseIssuer } from '@modelcontextprotocol/client'
import type { IntegrationConnectedSearch } from 'strategydance-core'
import {
  deleteIntegrationAuthorizationByState,
  getIntegrationAuthorizationByState,
  receiveIntegrationAuthorizationCode as storeIntegrationAuthorizationCode,
} from 'strategydance-database/backend'

import { MAX_INTEGRATION_TOKEN_LENGTH } from '~constants'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'
import toHyphenatedUuid from '~utils/toHyphenatedUuid'

import encryptIntegrationSecret from '~domain/integrations/encryptIntegrationSecret'
import readIntegrationRefusal from '~domain/integrations/readIntegrationRefusal'
import hashOAuthToken from '~domain/oauth/hashOAuthToken'
import parseOAuthParameters from '~domain/oauth/parseOAuthParameters'

// The parameters an authorization response carries (RFC 6749, 4.1.2 and 4.1.2.1, RFC 9207)
const RESPONSE_PARAMETERS = ['state', 'code', 'error', 'iss'] as const

/*
  What the callback does with an authorization server's answer to a member's sign-in, before anybody
  is known: it finds the Connect by its state's hash alone, and keeps the code, encrypted for that
  Connect and member, for two minutes, once, so a replayed or concurrent callback keeps nothing. The
  code is not exchanged here: the member's own page, signed in, finishes it, so a sign-in another
  account started and sent to them connects nothing (`finishIntegrationConnection`).

  The answer's issuer is checked against the one discovered (RFC 9207), as the authorization server
  said it would send it. A refusal, the member's or the server's, deletes the Connect. What it answers
  is the query of the page the browser goes on to, the ids hyphenated, so the router reads them as
  text: the Connect's when it was known, and how it went. Nothing it was sent is logged here
*/
async function receiveIntegrationAuthorizationCode(query: string): Promise<IntegrationConnectedSearch> {
  const parameters = parseOAuthParameters(query, RESPONSE_PARAMETERS)

  if (parameters.isRepeated || !parameters.values.state) return { outcome: 'failed' }

  const { state, code, error, iss } = parameters.values
  const stateHash = hashOAuthToken(state)
  const {
    data: {
      integrationAuthorizations: [authorization],
    },
  } = await getIntegrationAuthorizationByState(dataConnect, { stateHash })

  if (!authorization) return { outcome: 'failed' }

  const ids = {
    organization: toHyphenatedUuid(authorization.membershipOrganizationId),
    integration: toHyphenatedUuid(authorization.integrationId),
    authorization: toHyphenatedUuid(authorization.id),
  }
  const forget = async (outcome: 'denied' | 'failed') => {
    await deleteIntegrationAuthorizationByState(dataConnect, { authorizationId: authorization.id, stateHash })

    return { outcome, ...ids }
  }

  if (error) return forget(error === 'access_denied' ? 'denied' : 'failed')
  if (!code || code.length > MAX_INTEGRATION_TOKEN_LENGTH) return forget('failed')

  try {
    validateAuthorizationResponseIssuer({
      iss,
      expectedIssuer: authorization.issuer,
      issParameterSupported: authorization.isIssuerParameterSupported,
    })
  } catch {
    logger.info('Integrations: a sign-in came back from another issuer than its Connect discovered')

    return forget('failed')
  }

  try {
    const encryptedCode = await encryptIntegrationSecret(code, {
      purpose: 'authorization-code',
      organizationId: authorization.membershipOrganizationId,
      integrationId: authorization.integrationId,
      authorizationId: authorization.id,
      userId: authorization.membershipUserId,
    })

    await storeIntegrationAuthorizationCode(dataConnect, {
      authorizationId: authorization.id,
      stateHash,
      encryptedCode,
    })
  } catch (failure) {
    if (readIntegrationRefusal(failure) !== 'expired') throw failure

    return { outcome: 'failed', ...ids }
  }

  return { outcome: 'received', ...ids }
}

export default receiveIntegrationAuthorizationCode
