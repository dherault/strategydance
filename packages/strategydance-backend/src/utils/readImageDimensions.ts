// The JPEG markers that start a frame, whose header gives the picture's size: every SOF but the
// Huffman tables (C4), the reserved JPG (C8) and the arithmetic conditioning (CC), which share the range
const JPEG_FRAME_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])

// The JPEG markers that stand alone, with no length after them: the restart markers, the start and
// end of the image, and TEM
const JPEG_STANDALONE_MARKERS = new Set([0x01, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9])

// Where a JPEG's compressed data starts, after which no frame header is looked for
const JPEG_START_OF_SCAN = 0xda

type ImageDimensions = {
  width: number
  height: number
}

function readAscii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.subarray(start, end))
}

/*
  An image's width and height in pixels, read from its header, as Claude's limit on its sides is
  checked before anything is sent: a PNG's IHDR, a GIF's logical screen, a WebP's lossy, lossless or
  extended header, and a JPEG's frame header, found by walking its segments by their lengths, so an
  EXIF thumbnail's own frame header inside an APP1 segment is skipped whole. Null when the bytes are
  none of these, or end before the size
*/
function readImageDimensions(bytes: Uint8Array): ImageDimensions | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  if (
    bytes.length >= 24
    && bytes[0] === 0x89
    && readAscii(bytes, 1, 4) === 'PNG'
    && readAscii(bytes, 12, 16) === 'IHDR'
  ) {
    return { width: view.getUint32(16), height: view.getUint32(20) }
  }

  if (bytes.length >= 10 && (readAscii(bytes, 0, 6) === 'GIF87a' || readAscii(bytes, 0, 6) === 'GIF89a')) {
    return { width: view.getUint16(6, true), height: view.getUint16(8, true) }
  }

  if (bytes.length >= 16 && readAscii(bytes, 0, 4) === 'RIFF' && readAscii(bytes, 8, 12) === 'WEBP') {
    return readWebPDimensions(bytes, view)
  }

  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) return readJpegDimensions(bytes, view)

  return null
}

function readWebPDimensions(bytes: Uint8Array, view: DataView): ImageDimensions | null {
  const chunk = readAscii(bytes, 12, 16)

  // Lossy: a key frame's start code, then each side on 14 bits
  if (chunk === 'VP8 ' && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff }
  }

  // Lossless: a signature, then each side less one on 14 bits, packed
  if (chunk === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) {
    const [b0 = 0, b1 = 0, b2 = 0, b3 = 0] = bytes.subarray(21, 25)

    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
    }
  }

  // Extended: the canvas, each side less one on 24 bits
  if (chunk === 'VP8X' && bytes.length >= 30) {
    return {
      width: 1 + (view.getUint16(24, true) | ((bytes[26] ?? 0) << 16)),
      height: 1 + (view.getUint16(27, true) | ((bytes[29] ?? 0) << 16)),
    }
  }

  return null
}

function readJpegDimensions(bytes: Uint8Array, view: DataView): ImageDimensions | null {
  let offset = 2

  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) return null

    const marker = bytes[offset + 1] ?? 0

    // A fill byte before a marker
    if (marker === 0xff) {
      offset += 1

      continue
    }

    if (JPEG_STANDALONE_MARKERS.has(marker)) {
      offset += 2

      continue
    }

    if (marker === JPEG_START_OF_SCAN || offset + 4 > bytes.length) return null

    const length = view.getUint16(offset + 2)

    if (JPEG_FRAME_MARKERS.has(marker)) {
      if (offset + 9 > bytes.length) return null

      return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) }
    }

    offset += 2 + length
  }

  return null
}

export default readImageDimensions
