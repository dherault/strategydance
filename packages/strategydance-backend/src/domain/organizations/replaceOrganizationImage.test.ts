import { beforeEach, describe, expect, mock, test } from 'bun:test'

const ORGANIZATION_ID = '0F9C2B8E-4B1A-4D2C-9E7F-6A5B4C3D2E1F'

const BUCKET = 'strategydance.firebasestorage.app'

const LOGO_PREFIX = 'organizations/0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f/logo/'

const IMAGE = { bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]), contentType: 'image/png' }
const THUMBNAIL = { bytes: Buffer.from('RIFF'), contentType: 'image/webp' }

// What the row pointed at before the upload, the way Storage names a file in a download URL
function buildUrl(name: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(name)}?alt=media&token=t`
}

const saves: { name: string; bytes: Buffer }[] = []
const deletions: string[] = []
let saveFailures: (Error | undefined)[]
let rowFailure: Error | undefined
let logoWrites: Record<string, unknown>[]
let previousLogo: { logoUrl: string | null; logoThumbnailUrl: string | null }

mock.module('~firebase', () => ({
  bucket: {
    name: BUCKET,
    file: (name: string) => ({
      save: async (bytes: Buffer) => {
        const failure = saveFailures.shift()

        if (failure) throw failure

        saves.push({ name, bytes })
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
  updateOrganizationLogo: async (_dataConnect: unknown, variables: Record<string, unknown>) => {
    logoWrites.push(variables)

    if (rowFailure) throw rowFailure

    return { data: { previous: { organization: previousLogo } } }
  },
  updateOrganizationBanner: async () => ({ data: { previous: { organization: { bannerUrl: null } } } }),
}))

const { default: replaceOrganizationImage } = await import('./replaceOrganizationImage')

beforeEach(() => {
  saves.length = 0
  deletions.length = 0
  saveFailures = []
  rowFailure = undefined
  logoWrites = []
  previousLogo = { logoUrl: null, logoThumbnailUrl: null }
})

describe('replaceOrganizationImage', () => {
  test('saves the logo and its thumbnail under fresh names, points the row at both, and deletes the two they replaced', async () => {
    previousLogo = {
      logoUrl: buildUrl(`${LOGO_PREFIX}old-logo`),
      logoThumbnailUrl: buildUrl(`${LOGO_PREFIX}old-thumbnail`),
    }

    const result = await replaceOrganizationImage({
      organizationId: ORGANIZATION_ID,
      userId: 'admin',
      kind: 'logo',
      image: IMAGE,
      thumbnail: THUMBNAIL,
    })
    const [logoSave, thumbnailSave] = saves
    const [write] = logoWrites

    expect(saves.map(({ bytes }) => bytes)).toEqual([IMAGE.bytes, THUMBNAIL.bytes])
    expect(logoSave.name.startsWith(LOGO_PREFIX)).toBe(true)
    expect(thumbnailSave.name.startsWith(LOGO_PREFIX)).toBe(true)
    expect(logoSave.name).not.toBe(thumbnailSave.name)
    expect(write.logoUrl).toContain(encodeURIComponent(logoSave.name))
    expect(write.logoThumbnailUrl).toContain(encodeURIComponent(thumbnailSave.name))
    expect(result).toEqual({ outcome: 'replaced', url: write.logoUrl as string })
    expect(deletions.toSorted()).toEqual([`${LOGO_PREFIX}old-logo`, `${LOGO_PREFIX}old-thumbnail`])
  })

  test("clears the previous logo's thumbnail when the new one comes without", async () => {
    previousLogo = {
      logoUrl: buildUrl(`${LOGO_PREFIX}old-logo`),
      logoThumbnailUrl: buildUrl(`${LOGO_PREFIX}old-thumbnail`),
    }

    await replaceOrganizationImage({
      organizationId: ORGANIZATION_ID,
      userId: 'admin',
      kind: 'logo',
      image: IMAGE,
      thumbnail: null,
    })

    expect(saves).toHaveLength(1)
    expect(logoWrites[0].logoThumbnailUrl).toBeNull()
    expect(deletions.toSorted()).toEqual([`${LOGO_PREFIX}old-logo`, `${LOGO_PREFIX}old-thumbnail`])
  })

  test('deletes both new files and answers forbidden when the row refuses an administrator demoted meanwhile', async () => {
    rowFailure = new Error("Only an administrator can change an organization's logo")

    const result = await replaceOrganizationImage({
      organizationId: ORGANIZATION_ID,
      userId: 'admin',
      kind: 'logo',
      image: IMAGE,
      thumbnail: THUMBNAIL,
    })

    expect(result).toEqual({ outcome: 'forbidden' })
    expect(deletions.toSorted()).toEqual(saves.map(({ name }) => name).toSorted())
  })

  test('deletes the saved logo when its thumbnail fails to save, and writes no row', async () => {
    saveFailures = [undefined, new Error('Storage is down')]

    await expect(
      replaceOrganizationImage({
        organizationId: ORGANIZATION_ID,
        userId: 'admin',
        kind: 'logo',
        image: IMAGE,
        thumbnail: THUMBNAIL,
      }),
    ).rejects.toThrow('Storage is down')
    expect(logoWrites).toEqual([])
    expect(deletions).toEqual([saves[0].name])
  })
})
