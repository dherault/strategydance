// What a file's upload says of it in its headers
type UploadHeaders = {
  contentType?: string
  contentLength?: string
  fileName?: string
}

// What a route takes of a file, and the sentence that says which types when one is refused
export type UploadLimits = {
  contentTypes: readonly string[]
  maxSize: number
  maxNameLength: number
  unsupportedReason: string
}

type ParsedUploadHeaders =
  | { outcome: 'valid'; name: string; contentType: string; size: number }
  | { outcome: 'invalid'; reason: string }
  | { outcome: 'unsupported'; reason: string }
  | { outcome: 'tooLarge'; reason: string }

/*
  What an upload of a file declares, checked before anything is reserved, against what its route
  takes: its type, one of the route's, parameters aside; its size, given in `Content-Length`, which
  browsers always send and which the stored bytes have to match, within the route's most; and its
  name, URL-encoded in `X-File-Name` so any character travels in a header, on one line within the
  route's length, with no control character, trimmed
*/
function parseUploadHeaders(
  { contentType, contentLength, fileName }: UploadHeaders,
  { contentTypes, maxSize, maxNameLength, unsupportedReason }: UploadLimits,
): ParsedUploadHeaders {
  const type = contentType?.split(';')[0]?.trim().toLowerCase() ?? ''

  if (!contentTypes.includes(type)) return { outcome: 'unsupported', reason: unsupportedReason }

  if (!contentLength || !/^\d+$/.test(contentLength)) {
    return { outcome: 'invalid', reason: 'A file is uploaded with its Content-Length' }
  }

  const size = Number(contentLength)

  if (size < 1) return { outcome: 'invalid', reason: 'A file holds something' }
  if (size > maxSize) return { outcome: 'tooLarge', reason: `A file holds at most ${maxSize} bytes` }

  let name: string

  try {
    name = decodeURIComponent(fileName ?? '').trim()
  } catch {
    return { outcome: 'invalid', reason: 'A file name is URL-encoded in X-File-Name' }
  }

  if (!name || [...name].length > maxNameLength || /\p{Cc}/u.test(name)) {
    return { outcome: 'invalid', reason: `A file name is one line of at most ${maxNameLength} characters` }
  }

  return { outcome: 'valid', name, contentType: type, size }
}

export default parseUploadHeaders
