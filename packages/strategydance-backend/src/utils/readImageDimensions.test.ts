import { describe, expect, it } from 'bun:test'

import readImageDimensions from './readImageDimensions'

function bytesOf(...parts: (string | number[])[]) {
  return new Uint8Array(
    parts.flatMap(part => (typeof part === 'string' ? [...part].map(character => character.charCodeAt(0)) : part)),
  )
}

function uint32(value: number) {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]
}

function uint16(value: number) {
  return [(value >>> 8) & 0xff, value & 0xff]
}

function uint16LittleEndian(value: number) {
  return [value & 0xff, (value >>> 8) & 0xff]
}

function uint24LittleEndian(value: number) {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff]
}

// A JPEG frame header: its marker, length, precision, then height and width
function jpegFrame(width: number, height: number, marker = 0xc0) {
  return [0xff, marker, ...uint16(17), 8, ...uint16(height), ...uint16(width), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]
}

describe('readImageDimensions', () => {
  it("reads a PNG's IHDR", () => {
    const png = bytesOf([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a], uint32(13), 'IHDR', uint32(8001), uint32(600))

    expect(readImageDimensions(png)).toEqual({ width: 8001, height: 600 })
  })

  it("reads a GIF's logical screen", () => {
    expect(readImageDimensions(bytesOf('GIF89a', uint16LittleEndian(640), uint16LittleEndian(480)))).toEqual({
      width: 640,
      height: 480,
    })
  })

  it('reads a lossy, a lossless and an extended WebP', () => {
    const lossy = bytesOf(
      'RIFF',
      [0, 0, 0, 0],
      'WEBP',
      'VP8 ',
      [0, 0, 0, 0],
      [0, 0, 0],
      [0x9d, 0x01, 0x2a],
      uint16LittleEndian(1920),
      uint16LittleEndian(1080),
    )
    // 1000 by 750: each side less one, packed on 14 bits
    const width = 999
    const height = 749
    const lossless = bytesOf(
      'RIFF',
      [0, 0, 0, 0],
      'WEBP',
      'VP8L',
      [0, 0, 0, 0],
      [0x2f],
      [width & 0xff, ((width >> 8) & 0x3f) | ((height & 0x03) << 6), (height >> 2) & 0xff, (height >> 10) & 0x0f],
    )
    const extended = bytesOf(
      'RIFF',
      [0, 0, 0, 0],
      'WEBP',
      'VP8X',
      [10, 0, 0, 0],
      [0, 0, 0, 0],
      uint24LittleEndian(8999),
      uint24LittleEndian(99),
    )

    expect(readImageDimensions(lossy)).toEqual({ width: 1920, height: 1080 })
    expect(readImageDimensions(lossless)).toEqual({ width: 1000, height: 750 })
    expect(readImageDimensions(extended)).toEqual({ width: 9000, height: 100 })
  })

  it("reads a JPEG's frame header past an EXIF segment holding a thumbnail's own", () => {
    const exif = [...bytesOf('Exif', [0, 0]), ...jpegFrame(160, 120)]
    const jpeg = bytesOf(
      [0xff, 0xd8],
      [0xff, 0xe0, ...uint16(16)],
      'JFIF',
      [0, 1, 1, 0, 0, 1, 0, 1, 0, 0],
      [0xff, 0xe1, ...uint16(exif.length + 2)],
      exif,
      [0xff, 0xff],
      jpegFrame(4032, 3024, 0xc2),
    )

    expect(readImageDimensions(jpeg)).toEqual({ width: 4032, height: 3024 })
  })

  it('finds nothing in bytes that end before the size, or are no image', () => {
    expect(readImageDimensions(bytesOf([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a], uint32(13), 'IHDR'))).toBeNull()
    expect(readImageDimensions(bytesOf([0xff, 0xd8], [0xff, 0xe0, ...uint16(16)], 'JFIF'))).toBeNull()
    expect(readImageDimensions(bytesOf([0xff, 0xd8], [0xff, 0xda, ...uint16(8)]))).toBeNull()
    expect(readImageDimensions(bytesOf('%PDF-1.7'))).toBeNull()
  })
})
