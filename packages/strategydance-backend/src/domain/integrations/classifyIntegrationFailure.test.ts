import { describe, expect, test } from 'bun:test'

import { SdkError, SdkErrorCode, SdkHttpError, UnauthorizedError } from '@modelcontextprotocol/client'
import { IntegrationError } from 'strategydance-database/backend'

import { OutboundResponseRefusal } from '~utils/createGuardedFetch'
import { OutboundRefusal } from '~utils/requestOutbound'

import classifyIntegrationFailure from './classifyIntegrationFailure'

const ORIGIN = 'https://mcp.example.com'

function kindOf(error: unknown, hasKey = false) {
  return classifyIntegrationFailure(error, { hasKey, origin: ORIGIN }).kind
}

function httpError(status: number) {
  return new SdkHttpError(SdkErrorCode.ClientHttpNotImplemented, `HTTP ${status}`, { status, text: 'secret body' })
}

describe('classifyIntegrationFailure', () => {
  test('reads what the guard refused', () => {
    expect(kindOf(new OutboundRefusal('Not a public address', 'privateAddress'))).toBe(IntegrationError.ADDRESS_REFUSED)
    expect(kindOf(new OutboundResponseRefusal('Too large', true))).toBe(IntegrationError.TOO_MANY_TOOLS)
    expect(kindOf(new OutboundResponseRefusal('Compressed'))).toBe(IntegrationError.NOT_MCP_SERVER)
  })

  test('reads a 401 or a 403 as a refused key, or as authentication asked for when none was sent', () => {
    expect(kindOf(new UnauthorizedError('Unauthorized'), true)).toBe(IntegrationError.KEY_REFUSED)
    expect(kindOf(httpError(403), true)).toBe(IntegrationError.KEY_REFUSED)
    expect(kindOf(httpError(401), false)).toBe(IntegrationError.AUTHENTICATION_REQUIRED)
  })

  test('reads a server error as unreachable, and another answer as no MCP server', () => {
    expect(kindOf(httpError(503))).toBe(IntegrationError.UNREACHABLE)
    expect(kindOf(httpError(404))).toBe(IntegrationError.NOT_MCP_SERVER)
  })

  test('reads every way a deadline passes as a timeout', () => {
    expect(kindOf(new DOMException('The operation timed out', 'TimeoutError'))).toBe(IntegrationError.TIMED_OUT)
    expect(kindOf(new SdkError(SdkErrorCode.RequestTimeout, 'Request timed out'))).toBe(IntegrationError.TIMED_OUT)
    expect(kindOf(Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' }))).toBe(
      IntegrationError.TIMED_OUT,
    )
  })

  test('reads a network failure as unreachable, however deep the SDK wrapped it', () => {
    const refused = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })
    const certificate = Object.assign(new Error('unable to verify'), { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' })

    expect(kindOf(new Error('fetch failed', { cause: refused }))).toBe(IntegrationError.UNREACHABLE)
    expect(kindOf(new Error('Send failed', { cause: new Error('fetch failed', { cause: certificate }) }))).toBe(
      IntegrationError.UNREACHABLE,
    )
  })

  test('never carries what the server answered into its message', () => {
    expect(classifyIntegrationFailure(httpError(404), { hasKey: false, origin: ORIGIN }).message).not.toContain(
      'secret body',
    )
  })

  test('reads what a discovery could not read as a failed discovery, an answer past the cap included', () => {
    const discovering = { hasKey: false, origin: ORIGIN, isDiscovery: true }

    expect(classifyIntegrationFailure(new Error('HTTP 500 trying to load metadata'), discovering).kind).toBe(
      IntegrationError.DISCOVERY_FAILED,
    )
    expect(classifyIntegrationFailure(new OutboundResponseRefusal('Too large', true), discovering).kind).toBe(
      IntegrationError.DISCOVERY_FAILED,
    )
  })
})
