import { describe, expect, it } from 'bun:test'
import { Readable } from 'node:stream'

import createAttachmentUploadCheck, { AttachmentUploadRefusal } from './createAttachmentUploadCheck'

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

async function pass(chunks: Buffer[], contentType: string, size: number) {
  const output: Buffer[] = []

  for await (const chunk of Readable.from(chunks).pipe(createAttachmentUploadCheck({ contentType, size }))) {
    output.push(chunk)
  }

  return Buffer.concat(output)
}

async function refusal(chunks: Buffer[], contentType: string, size: number) {
  try {
    await pass(chunks, contentType, size)
  } catch (error) {
    return error instanceof AttachmentUploadRefusal ? error.reason : error
  }

  return null
}

describe('createAttachmentUploadCheck', () => {
  it('passes a file whose signature and size are those declared on, byte for byte', async () => {
    const body = Buffer.concat([PNG, Buffer.alloc(10_000, 7)])
    const chunks = [body.subarray(0, 3), body.subarray(3, 5000), body.subarray(5000)]

    expect(await pass(chunks, 'image/png', body.length)).toEqual(body)
    expect(await pass([Buffer.from('# Hi')], 'text/markdown', 4)).toEqual(Buffer.from('# Hi'))
  })

  it('refuses a signature that is not the type declared', async () => {
    expect(await refusal([PNG], 'application/pdf', PNG.length)).toBe('unsupported')
    expect(await refusal([Buffer.concat([PNG, Buffer.alloc(5000)])], 'image/jpeg', PNG.length + 5000)).toBe(
      'unsupported',
    )
  })

  it('refuses more bytes than declared at once, and fewer at the end', async () => {
    expect(await refusal([PNG, Buffer.alloc(10)], 'image/png', PNG.length + 5)).toBe('tooLarge')
    expect(await refusal([PNG], 'image/png', PNG.length + 5)).toBe('incomplete')
  })
})
