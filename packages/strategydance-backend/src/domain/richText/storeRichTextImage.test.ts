import { describe, expect, mock, test } from 'bun:test'

const ORGANIZATION_ID = '0F9C2B8E-4B1A-4D2C-9E7F-6A5B4C3D2E1F'

const saves: { name: string; bytes: Buffer; options: Record<string, unknown> }[] = []

mock.module('~firebase', () => ({
  bucket: {
    name: 'strategydance.firebasestorage.app',
    file: (name: string) => ({
      save: async (bytes: Buffer, options: Record<string, unknown>) => {
        saves.push({ name, bytes, options })
      },
    }),
  },
  dataConnect: {},
}))

const { default: storeRichTextImage } = await import('./storeRichTextImage')

describe('storeRichTextImage', () => {
  test("saves the picture under a fresh name in the organization's rich text folder, and answers with its URL", async () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    const url = await storeRichTextImage({ organizationId: ORGANIZATION_ID, bytes, contentType: 'image/png' })
    const [save] = saves

    expect(save.name).toMatch(/^organizations\/0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f\/rich-text\/[0-9a-f-]{36}$/)
    expect(save.bytes).toBe(bytes)
    expect(save.options).toMatchObject({
      resumable: false,
      contentType: 'image/png',
      metadata: { cacheControl: 'private, max-age=31536000, immutable' },
    })

    const token = (save.options.metadata as { metadata: { firebaseStorageDownloadTokens: string } }).metadata
      .firebaseStorageDownloadTokens

    expect(url).toEndWith(
      `/v0/b/strategydance.firebasestorage.app/o/${encodeURIComponent(save.name)}?alt=media&token=${token}`,
    )
  })

  test('gives every picture a name and a token of its own', async () => {
    saves.length = 0

    const bytes = Buffer.from([0xff, 0xd8, 0xff])
    const first = await storeRichTextImage({ organizationId: ORGANIZATION_ID, bytes, contentType: 'image/jpeg' })
    const second = await storeRichTextImage({ organizationId: ORGANIZATION_ID, bytes, contentType: 'image/jpeg' })

    expect(saves[0].name).not.toBe(saves[1].name)
    expect(first).not.toBe(second)
  })
})
