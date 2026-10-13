import { describe, expect, it } from 'bun:test'

import { INTEGRATION_CATALOGUE, MAX_INTEGRATION_API_KEY_LENGTH, MAX_INTEGRATION_NAME_LENGTH } from '../constants'

import {
  isReservedIntegrationHeader,
  isValidIntegrationApiKey,
  isValidIntegrationApiKeyHeader,
  isValidIntegrationName,
  normalizeIntegrationName,
  parseIntegrationUrl,
} from './integration'

describe('isValidIntegrationName', () => {
  it('takes a name on one line, within the length', () => {
    expect(isValidIntegrationName('Notion')).toBe(true)
    expect(isValidIntegrationName('  Web search  ')).toBe(true)
    expect(isValidIntegrationName('a'.repeat(MAX_INTEGRATION_NAME_LENGTH))).toBe(true)
  })

  it('refuses a blank name, a long one and one holding a line break or a control character', () => {
    expect(isValidIntegrationName('   ')).toBe(false)
    expect(isValidIntegrationName('a'.repeat(MAX_INTEGRATION_NAME_LENGTH + 1))).toBe(false)
    expect(isValidIntegrationName('Two\nlines')).toBe(false)
    expect(isValidIntegrationName('Bell\u0007')).toBe(false)
    expect(isValidIntegrationName('Separated\u2028name')).toBe(false)
  })
})

describe('normalizeIntegrationName', () => {
  it('reads two spellings of one name as one', () => {
    expect(normalizeIntegrationName(' Notion ')).toBe(normalizeIntegrationName('notion'))
  })
})

describe('parseIntegrationUrl', () => {
  it('writes an https address back as the URL parser does', () => {
    expect(parseIntegrationUrl('https://mcp.vercel.com')).toBe('https://mcp.vercel.com/')
    expect(parseIntegrationUrl('  https://MCP.Linear.app/mcp  ')).toBe('https://mcp.linear.app/mcp')
    expect(parseIntegrationUrl('https://example.com/mcp?team=1')).toBe('https://example.com/mcp?team=1')
  })

  it('refuses another protocol, another port, credentials, a fragment and what is no address', () => {
    expect(parseIntegrationUrl('http://mcp.example.com/mcp')).toBeNull()
    expect(parseIntegrationUrl('https://mcp.example.com:8443/mcp')).toBeNull()
    expect(parseIntegrationUrl('https://user:secret@mcp.example.com/mcp')).toBeNull()
    expect(parseIntegrationUrl('https://mcp.example.com/mcp#tools')).toBeNull()
    expect(parseIntegrationUrl('mcp.example.com')).toBeNull()
    expect(parseIntegrationUrl(`https://example.com/${'a'.repeat(2000)}`)).toBeNull()
  })

  it('takes every address of the catalogue as it is written', () => {
    for (const { url } of INTEGRATION_CATALOGUE) expect(parseIntegrationUrl(url)).toBe(new URL(url).href)
  })
})

describe('isValidIntegrationApiKey', () => {
  it('takes printable ASCII, spaces between other characters included', () => {
    expect(isValidIntegrationApiKey('sk_live_51Hx')).toBe(true)
    expect(isValidIntegrationApiKey('Token abc.def')).toBe(true)
  })

  it('refuses a key that would split its header or is too long', () => {
    expect(isValidIntegrationApiKey('')).toBe(false)
    expect(isValidIntegrationApiKey(' leading')).toBe(false)
    expect(isValidIntegrationApiKey('trailing ')).toBe(false)
    expect(isValidIntegrationApiKey('abc\r\nX-Injected: 1')).toBe(false)
    expect(isValidIntegrationApiKey('abc\u0000def')).toBe(false)
    expect(isValidIntegrationApiKey('clé')).toBe(false)
    expect(isValidIntegrationApiKey('a'.repeat(MAX_INTEGRATION_API_KEY_LENGTH + 1))).toBe(false)
  })
})

describe('isValidIntegrationApiKeyHeader', () => {
  it('takes a header a server reads a key from', () => {
    expect(isValidIntegrationApiKeyHeader('X-API-Key')).toBe(true)
    expect(isValidIntegrationApiKeyHeader('Authorization')).toBe(true)
  })

  it('refuses what is not a header name, or is too long', () => {
    expect(isValidIntegrationApiKeyHeader('')).toBe(false)
    expect(isValidIntegrationApiKeyHeader('X API Key')).toBe(false)
    expect(isValidIntegrationApiKeyHeader('X-Key:')).toBe(false)
    expect(isValidIntegrationApiKeyHeader(`X-${'a'.repeat(63)}`)).toBe(false)
  })

  it('refuses a reserved header', () => {
    expect(isValidIntegrationApiKeyHeader('Content-Type')).toBe(false)
  })
})

describe('isReservedIntegrationHeader', () => {
  it('names the headers the client sets itself and the ones a connection or a proxy acts on', () => {
    for (const name of [
      'Host',
      'Content-Length',
      'content-type',
      'Cookie',
      'Connection',
      'Transfer-Encoding',
      'Accept',
      'Last-Event-ID',
      'TE',
      'Upgrade',
    ]) {
      expect(isReservedIntegrationHeader(name)).toBe(true)
    }
  })

  it('names every header of the Proxy-, Sec- and Mcp- families, whatever the case', () => {
    expect(isReservedIntegrationHeader('Proxy-Authorization')).toBe(true)
    expect(isReservedIntegrationHeader('sec-fetch-site')).toBe(true)
    expect(isReservedIntegrationHeader('MCP-Protocol-Version')).toBe(true)
    expect(isReservedIntegrationHeader('Mcp-Session-Id')).toBe(true)
  })

  it('leaves the headers a key is sent in', () => {
    expect(isReservedIntegrationHeader('Authorization')).toBe(false)
    expect(isReservedIntegrationHeader('X-API-Key')).toBe(false)
    expect(isReservedIntegrationHeader('X-Proxy-Key')).toBe(false)
  })
})
