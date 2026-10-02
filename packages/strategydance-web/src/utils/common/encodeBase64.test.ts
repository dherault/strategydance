import { describe, expect, it } from 'bun:test'

import decodeBase64 from '~utils/common/decodeBase64'
import encodeBase64 from '~utils/common/encodeBase64'

describe('encodeBase64', () => {
  it('writes bytes as base64, which decodeBase64 reads back', () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255])

    expect(encodeBase64(bytes)).toBe('AAF/gP8=')
    expect(decodeBase64(encodeBase64(bytes))).toEqual(bytes)
  })

  it('writes a snapshot far longer than one call can take', () => {
    const bytes = new Uint8Array(1_000_000).map((_, index) => index % 256)

    expect(decodeBase64(encodeBase64(bytes))).toEqual(bytes)
  })
})

describe('decodeBase64', () => {
  it('throws on a string that is not base64', () => {
    expect(() => decodeBase64('not base64!')).toThrow()
  })
})
