import { describe, expect, it } from 'bun:test'

import parseConversationAttachmentHeaders from './parseConversationAttachmentHeaders'

describe('parseConversationAttachmentHeaders', () => {
  it('reads the type without its parameters, the size and the decoded name', () => {
    expect(
      parseConversationAttachmentHeaders({
        contentType: 'text/markdown; charset=utf-8',
        contentLength: '1200',
        fileName: encodeURIComponent(' Prix d’été 🌞.md '),
      }),
    ).toEqual({ outcome: 'valid', name: 'Prix d’été 🌞.md', contentType: 'text/markdown', size: 1200 })
  })

  it('refuses a type a conversation does not take', () => {
    expect(
      parseConversationAttachmentHeaders({ contentType: 'image/svg+xml', contentLength: '10', fileName: 'a.svg' }),
    ).toMatchObject({ outcome: 'unsupported' })
  })

  it('refuses a missing, an empty and a too large size', () => {
    expect(parseConversationAttachmentHeaders({ contentType: 'image/png', fileName: 'a.png' })).toMatchObject({
      outcome: 'invalid',
    })
    expect(
      parseConversationAttachmentHeaders({ contentType: 'image/png', contentLength: '0', fileName: 'a.png' }),
    ).toMatchObject({ outcome: 'invalid' })
    expect(
      parseConversationAttachmentHeaders({ contentType: 'image/png', contentLength: '10485761', fileName: 'a.png' }),
    ).toMatchObject({ outcome: 'tooLarge' })
  })

  it('refuses a name badly encoded, empty, on two lines or past 200 characters', () => {
    const upload = { contentType: 'text/plain', contentLength: '10' }

    expect(parseConversationAttachmentHeaders({ ...upload, fileName: '%E0%A4%A' })).toMatchObject({
      outcome: 'invalid',
    })
    expect(parseConversationAttachmentHeaders({ ...upload, fileName: '%20' })).toMatchObject({ outcome: 'invalid' })
    expect(parseConversationAttachmentHeaders({ ...upload, fileName: 'a%0Ab.txt' })).toMatchObject({
      outcome: 'invalid',
    })
    expect(parseConversationAttachmentHeaders({ ...upload, fileName: 'a'.repeat(201) })).toMatchObject({
      outcome: 'invalid',
    })
    expect(parseConversationAttachmentHeaders({ ...upload, fileName: '🌞'.repeat(200) })).toMatchObject({
      outcome: 'valid',
    })
  })
})
