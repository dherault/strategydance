import { pipeline, type Readable } from 'node:stream'

import type { Response } from 'express'
import { ERROR_CODE_NOT_FOUND } from 'strategydance-core'

import respondError from '~utils/respondError'

// What a stored file's row says of it
type StoredFile = {
  name: string
  contentType: string
  size: number
}

/*
  Answers a stored file's bytes as they stream from the bucket, typed, sized and named as its row
  says, text in UTF-8, shown in place rather than downloaded, and kept privately for good, since a
  stored file's bytes never change. A file the bucket no longer holds is a 404 while nothing was
  sent, and a cut answer after. Piped through a pipeline, so a reader that goes away mid-file stops
  the bucket's stream rather than leave it open
*/
function respondStoredFile(response: Response, stream: Readable, { name, contentType, size }: StoredFile) {
  stream.once('error', () => {
    if (response.headersSent) response.destroy()
    else respondError(response, 404, ERROR_CODE_NOT_FOUND, 'This file no longer exists')
  })
  stream.once('readable', () => {
    response.setHeader('Content-Type', contentType.startsWith('text/') ? `${contentType}; charset=utf-8` : contentType)
    response.setHeader('Content-Length', size)
    response.setHeader('Cache-Control', 'private, max-age=31536000, immutable')
    response.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeHeaderValue(name)}`)
    // Its failures are the stream's, which the listener above answers
    pipeline(stream, response, () => {})
  })
}

// A file's name as an RFC 5987 value, which takes none of the characters `encodeURIComponent` leaves
function encodeHeaderValue(value: string) {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

export default respondStoredFile
