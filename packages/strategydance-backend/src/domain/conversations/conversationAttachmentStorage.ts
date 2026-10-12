import type { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { bucket } from '~firebase'

// A file never changes once stored, so whoever may read it may keep it
const CACHE_CONTROL = 'private, max-age=31536000, immutable'

// What writing an object create-only came to: written, or an object was there already, of that size
export type AttachmentObjectWrite = { outcome: 'written' } | { outcome: 'exists'; size: number }

// What copying an object create-only came to: copied, a copy there already, or no source to copy
export type AttachmentObjectCopy = { outcome: 'copied' } | { outcome: 'exists'; size: number } | { outcome: 'missing' }

/*
  Where the files sent in conversations are kept, the bucket's `pending/` and conversations'
  folders, and the one module that touches them, so the tests stand a fake in for it.

  Every object is written create-only, since every replay of a conversation depends on its bytes
  never changing: a generation-match-zero precondition refuses a second write of one name, and an
  upload that fails leaves no object, Storage finalizing it at once. The Storage emulator ignores
  preconditions, so a write and a copy first read what is there and treat an object found as the
  precondition would, which the precondition still guards against in production
*/
export type AttachmentStorage = {
  // Writes an object from a stream, made only once no object is found there; a stream that fails
  // leaves none
  write(name: string, contentType: string, createBody: () => Readable): Promise<AttachmentObjectWrite>
  // An object's size, or null when there is none
  readSize(name: string): Promise<number | null>
  read(name: string): Promise<Uint8Array>
  openRead(name: string): Readable
  // Copies an object to another name, unless one is there
  copy(from: string, to: string): Promise<AttachmentObjectCopy>
  // Deletes an object, whether or not it is there
  delete(name: string): Promise<void>
  // Deletes every object under a prefix
  deleteFolder(prefix: string): Promise<void>
}

function readStatus(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error ? error.code : null
}

async function readSize(name: string) {
  try {
    const [metadata] = await bucket.file(name).getMetadata()

    return Number(metadata.size)
  } catch (error) {
    if (readStatus(error) === 404) return null

    throw error
  }
}

const conversationAttachmentStorage: AttachmentStorage = {
  async write(name, contentType, createBody) {
    const existing = await readSize(name)

    if (existing !== null) return { outcome: 'exists', size: existing }

    try {
      await pipeline(
        createBody(),
        bucket.file(name).createWriteStream({
          resumable: false,
          contentType,
          preconditionOpts: { ifGenerationMatch: 0 },
          metadata: { cacheControl: CACHE_CONTROL },
        }),
      )

      return { outcome: 'written' }
    } catch (error) {
      const size = readStatus(error) === 412 ? await readSize(name) : null

      if (size !== null) return { outcome: 'exists', size }

      throw error
    }
  },

  readSize,

  async read(name) {
    const [bytes] = await bucket.file(name).download()

    return bytes
  },

  openRead(name) {
    return bucket.file(name).createReadStream()
  },

  async copy(from, to) {
    const existing = await readSize(to)

    if (existing !== null) return { outcome: 'exists', size: existing }

    try {
      await bucket.file(from).copy(bucket.file(to), { preconditionOpts: { ifGenerationMatch: 0 } })

      return { outcome: 'copied' }
    } catch (error) {
      const status = readStatus(error)

      if (status === 404) return { outcome: 'missing' }

      const size = status === 412 ? await readSize(to) : null

      if (size !== null) return { outcome: 'exists', size }

      throw error
    }
  },

  async delete(name) {
    await bucket.file(name).delete({ ignoreNotFound: true })
  },

  async deleteFolder(prefix) {
    await bucket.deleteFiles({ prefix, force: true })
  },
}

export default conversationAttachmentStorage
