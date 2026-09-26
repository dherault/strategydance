const PNG_SIGNATURE = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]

const JPEG_SIGNATURE = [0xFF, 0xD8, 0xFF]

function startsWith(bytes: Uint8Array, signature: number[], offset = 0) {
  return bytes.length >= offset + signature.length && signature.every((byte, index) => bytes[offset + index] === byte)
}

function readAscii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.subarray(start, end))
}

/*
  What a file is, read off its first bytes rather than off the request that carried it, or null
  when it is none of the pictures an organization may carry.

  The type a request declares is whatever its sender wrote. Storage serves a file with the type
  it was saved with, so saving an SVG or an HTML page under `image/png` because the request said
  so would publish it as whatever the next browser sniffs it to be
*/
function sniffImageContentType(bytes: Uint8Array) {
  if (startsWith(bytes, PNG_SIGNATURE)) return 'image/png'
  if (startsWith(bytes, JPEG_SIGNATURE)) return 'image/jpeg'

  const gifHeader = readAscii(bytes, 0, 6)

  if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') return 'image/gif'
  if (readAscii(bytes, 0, 4) === 'RIFF' && readAscii(bytes, 8, 12) === 'WEBP') return 'image/webp'

  return null
}

export default sniffImageContentType
