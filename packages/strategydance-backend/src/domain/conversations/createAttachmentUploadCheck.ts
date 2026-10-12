import { Transform, type TransformCallback } from 'node:stream'

import sniffConversationAttachment from '~utils/sniffConversationAttachment'

// How many of a file's first bytes are read before any is passed on, which every signature fits in
// and a text file's first NUL byte most likely shows in
const SNIFFED_LENGTH = 4096

// Why an upload's bytes were refused: not the type declared, more than declared, or fewer
export class AttachmentUploadRefusal extends Error {
  constructor(
    readonly reason: 'unsupported' | 'tooLarge' | 'incomplete',
    message: string,
  ) {
    super(message)
  }
}

type AttachmentUploadCheck = {
  contentType: string
  // What the upload declared in its `Content-Length`
  size: number
}

/*
  What an upload's bytes pass through on their way into Storage: their first bytes held back until
  their signature is checked against the type the upload declared, and every byte counted against
  the size it declared, more refused at once and fewer at the end. A refusal fails the stream, and
  Storage then keeps nothing of it
*/
function createAttachmentUploadCheck({ contentType, size }: AttachmentUploadCheck) {
  const head: Buffer[] = []
  let headLength = 0
  let received = 0
  let isSniffed = false

  function sniff(stream: Transform) {
    const bytes = Buffer.concat(head)

    if (!sniffConversationAttachment(bytes, contentType)) {
      return new AttachmentUploadRefusal('unsupported', `The file is not a ${contentType} file`)
    }

    isSniffed = true
    stream.push(bytes)

    return null
  }

  return new Transform({
    transform(chunk: Buffer, _encoding, callback: TransformCallback) {
      received += chunk.length

      if (received > size) {
        callback(new AttachmentUploadRefusal('tooLarge', `The file holds more than the ${size} bytes it declared`))

        return
      }

      if (isSniffed) {
        callback(null, chunk)

        return
      }

      head.push(chunk)
      headLength += chunk.length

      callback(headLength >= SNIFFED_LENGTH ? sniff(this) : null)
    },

    flush(callback: TransformCallback) {
      const refusal = isSniffed ? null : sniff(this)

      if (refusal) {
        callback(refusal)

        return
      }

      if (received !== size) {
        callback(
          new AttachmentUploadRefusal('incomplete', `The file held ${received} of the ${size} bytes it declared`),
        )

        return
      }

      callback()
    },
  })
}

export default createAttachmentUploadCheck
