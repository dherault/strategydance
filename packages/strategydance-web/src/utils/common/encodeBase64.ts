// How many bytes go through `String.fromCharCode` at once, well under any engine's argument limit
const CHUNK_SIZE = 0x8000

/*
  Bytes as base64, as a Yjs update is stored in a string column. Read a chunk at a time, since a
  document's snapshot runs to hundreds of kilobytes and spreading them all into one call would
  overflow the stack
*/
function encodeBase64(bytes: Uint8Array) {
  let binary = ''

  for (let index = 0; index < bytes.length; index += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK_SIZE))
  }

  return btoa(binary)
}

export default encodeBase64
