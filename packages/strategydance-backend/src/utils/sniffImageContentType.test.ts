import { describe, expect, it } from 'bun:test'

import sniffImageContentType from './sniffImageContentType'

function bytesOf(...parts: (string | number[])[]) {
  return new Uint8Array(parts.flatMap(part => typeof part === 'string' ? [...part].map(character => character.charCodeAt(0)) : part))
}

describe('sniffImageContentType', () => {
  it('reads the four accepted pictures off their signatures', () => {
    expect(sniffImageContentType(bytesOf([0x89], 'PNG', [0x0D, 0x0A, 0x1A, 0x0A], 'IHDR'))).toBe('image/png')
    expect(sniffImageContentType(bytesOf([0xFF, 0xD8, 0xFF, 0xE0], 'JFIF'))).toBe('image/jpeg')
    expect(sniffImageContentType(bytesOf('GIF89a', [0x01, 0x00]))).toBe('image/gif')
    expect(sniffImageContentType(bytesOf('GIF87a'))).toBe('image/gif')
    expect(sniffImageContentType(bytesOf('RIFF', [0x24, 0x00, 0x00, 0x00], 'WEBPVP8 '))).toBe('image/webp')
  })

  it('refuses an SVG, whatever it was sent as', () => {
    expect(sniffImageContentType(bytesOf('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull()
    expect(sniffImageContentType(bytesOf('<?xml version="1.0"?><svg/>'))).toBeNull()
  })

  it('refuses a RIFF file that is not a WebP, like a WAV', () => {
    expect(sniffImageContentType(bytesOf('RIFF', [0x24, 0x00, 0x00, 0x00], 'WAVEfmt '))).toBeNull()
  })

  it('refuses a file too short to carry a signature', () => {
    expect(sniffImageContentType(new Uint8Array())).toBeNull()
    expect(sniffImageContentType(bytesOf([0x89], 'PN'))).toBeNull()
    expect(sniffImageContentType(bytesOf([0xFF, 0xD8]))).toBeNull()
  })
})
