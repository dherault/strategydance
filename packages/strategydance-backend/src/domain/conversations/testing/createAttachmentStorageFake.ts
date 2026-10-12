import { Readable } from 'node:stream'

import type { AttachmentStorage } from '~domain/conversations/conversationAttachmentStorage'

type StoredObject = {
  bytes: Uint8Array
  contentType: string
}

/*
  The bucket's attachments for the tests, in memory: objects by name, written create-only as the
  real bucket's precondition writes them, so a second write of one name, even one that started
  first, finds the first, and a stream that fails stores nothing. `calls` records what was asked, in
  order, and `failures` fails the next call of a method, one error each
*/
function createAttachmentStorageFake() {
  const objects = new Map<string, StoredObject>()
  const calls: string[] = []
  const failures: Partial<Record<keyof AttachmentStorage, Error[]>> = {}

  function fail(method: keyof AttachmentStorage) {
    const failure = failures[method]?.shift()

    if (failure) throw failure
  }

  const storage: AttachmentStorage = {
    async write(name, contentType, body) {
      calls.push(`write ${name}`)
      fail('write')

      const existing = objects.get(name)

      if (existing) return { outcome: 'exists', size: existing.bytes.length }

      const chunks: Buffer[] = []

      for await (const chunk of body) chunks.push(Buffer.from(chunk))

      const raced = objects.get(name)

      if (raced) return { outcome: 'exists', size: raced.bytes.length }

      objects.set(name, { bytes: new Uint8Array(Buffer.concat(chunks)), contentType })

      return { outcome: 'written' }
    },

    async readSize(name) {
      calls.push(`readSize ${name}`)
      fail('readSize')

      return objects.get(name)?.bytes.length ?? null
    },

    async read(name) {
      calls.push(`read ${name}`)
      fail('read')

      const object = objects.get(name)

      if (!object) throw Object.assign(new Error(`No such object: ${name}`), { code: 404 })

      return object.bytes
    },

    openRead(name) {
      calls.push(`openRead ${name}`)

      const object = objects.get(name)

      if (!object) throw Object.assign(new Error(`No such object: ${name}`), { code: 404 })

      return Readable.from([Buffer.from(object.bytes)])
    },

    async copy(from, to) {
      calls.push(`copy ${from} ${to}`)
      fail('copy')

      const existing = objects.get(to)

      if (existing) return { outcome: 'exists', size: existing.bytes.length }

      const source = objects.get(from)

      if (!source) return { outcome: 'missing' }

      objects.set(to, { ...source })

      return { outcome: 'copied' }
    },

    async delete(name) {
      calls.push(`delete ${name}`)
      fail('delete')

      objects.delete(name)
    },

    async deleteFolder(prefix) {
      calls.push(`deleteFolder ${prefix}`)
      fail('deleteFolder')

      for (const name of objects.keys()) {
        if (name.startsWith(prefix)) objects.delete(name)
      }
    },
  }

  return { storage, objects, calls, failures }
}

export default createAttachmentStorageFake
