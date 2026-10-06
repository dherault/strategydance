import { beforeEach, describe, expect, mock, test } from 'bun:test'

const ORGANIZATION_ID = '0F9C2B8E-4B1A-4D2C-9E7F-6A5B4C3D2E1F'

const saves: { name: string; bytes: Buffer; options: Record<string, unknown> }[] = []
const deletions: string[] = []
let isMember = true
let membershipFailure: Error | undefined

mock.module('~firebase', () => ({
  bucket: {
    name: 'strategydance.firebasestorage.app',
    file: (name: string) => ({
      save: async (bytes: Buffer, options: Record<string, unknown>) => {
        saves.push({ name, bytes, options })
      },
      delete: async () => {
        deletions.push(name)
      },
    }),
  },
  dataConnect: {},
}))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => ({
  getOrganizationMembership: async () => {
    if (membershipFailure) throw membershipFailure

    return { data: { userOrganization: isMember ? { role: 'MEMBER' } : null } }
  },
}))

const { default: storeRichTextImage } = await import('./storeRichTextImage')

beforeEach(() => {
  saves.length = 0
  deletions.length = 0
  isMember = true
  membershipFailure = undefined
})

describe('storeRichTextImage', () => {
  test("saves the picture under a fresh name in the organization's rich text folder, and answers with its URL", async () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    const result = await storeRichTextImage({
      organizationId: ORGANIZATION_ID,
      userId: 'member',
      bytes,
      contentType: 'image/png',
    })
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

    expect(result).toEqual({
      outcome: 'stored',
      url: expect.stringMatching(
        new RegExp(
          `/v0/b/strategydance\\.firebasestorage\\.app/o/${encodeURIComponent(save.name)}\\?alt=media&token=${token}$`,
        ),
      ),
    })
  })

  test('gives every picture a name and a token of its own', async () => {
    const input = {
      organizationId: ORGANIZATION_ID,
      userId: 'member',
      bytes: Buffer.from([1]),
      contentType: 'image/jpeg',
    }
    const first = await storeRichTextImage(input)
    const second = await storeRichTextImage(input)

    expect(saves[0].name).not.toBe(saves[1].name)
    expect(first).not.toEqual(second)
  })

  test('deletes the picture and refuses when the uploader no longer belongs, as after a deletion that raced it', async () => {
    isMember = false

    const result = await storeRichTextImage({
      organizationId: ORGANIZATION_ID,
      userId: 'member',
      bytes: Buffer.from([1]),
      contentType: 'image/png',
    })

    expect(result).toEqual({ outcome: 'forbidden' })
    expect(deletions).toEqual([saves[0].name])
  })

  test('deletes the picture and fails when the membership cannot be read', async () => {
    membershipFailure = new Error('Data Connect is down')

    await expect(
      storeRichTextImage({
        organizationId: ORGANIZATION_ID,
        userId: 'member',
        bytes: Buffer.from([1]),
        contentType: 'image/png',
      }),
    ).rejects.toThrow('Data Connect is down')
    expect(deletions).toEqual([saves[0].name])
  })
})
