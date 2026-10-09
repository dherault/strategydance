import { beforeEach, describe, expect, mock, test } from 'bun:test'

const PICTURE_PATH = 'users/someone/profile-picture'
const THUMBNAIL_PATH = 'users/someone/profile-picture-thumbnail'

// What reached Storage, in order
let steps: string[]
let uploadFailures: Record<string, Error>
let deleteFailure: Error | undefined
let thumbnail: Blob | null

mock.module('~data/firebase', () => ({ storage: {} }))

mock.module('~utils/common/createImageThumbnail', () => ({ default: async () => thumbnail }))

mock.module('firebase/storage', () => ({
  ref: (_storage: unknown, path: string) => ({ fullPath: path }),
  uploadBytes: async (reference: { fullPath: string }) => {
    steps.push(`upload ${reference.fullPath}`)

    const failure = uploadFailures[reference.fullPath]

    if (failure) throw failure

    return { ref: reference }
  },
  getDownloadURL: async (reference: { fullPath: string }) => `https://storage.test/${reference.fullPath}`,
  deleteObject: async (reference: { fullPath: string }) => {
    steps.push(`delete ${reference.fullPath}`)

    if (deleteFailure) throw deleteFailure
  },
}))

const { default: uploadProfilePicture } = await import('./uploadProfilePicture')

const PICTURE = new Blob(['picture'], { type: 'image/png' })

beforeEach(() => {
  steps = []
  uploadFailures = {}
  deleteFailure = undefined
  thumbnail = new Blob(['thumbnail'], { type: 'image/webp' })
})

describe('uploadProfilePicture', () => {
  test('puts the picture up, then its thumbnail, and answers with both URLs', async () => {
    expect(await uploadProfilePicture('someone', PICTURE)).toEqual({
      imageUrl: `https://storage.test/${PICTURE_PATH}`,
      imageThumbnailUrl: `https://storage.test/${THUMBNAIL_PATH}`,
    })
    expect(steps).toEqual([`upload ${PICTURE_PATH}`, `upload ${THUMBNAIL_PATH}`])
  })

  test('answers no thumbnail and deletes the previous one when the thumbnail fails to go up', async () => {
    uploadFailures[THUMBNAIL_PATH] = new Error('Network down')

    expect(await uploadProfilePicture('someone', PICTURE)).toEqual({
      imageUrl: `https://storage.test/${PICTURE_PATH}`,
      imageThumbnailUrl: null,
    })
    expect(steps).toEqual([`upload ${PICTURE_PATH}`, `upload ${THUMBNAIL_PATH}`, `delete ${THUMBNAIL_PATH}`])
  })

  test('answers no thumbnail and deletes the previous one when the browser could not draw one', async () => {
    thumbnail = null

    expect(await uploadProfilePicture('someone', PICTURE)).toEqual({
      imageUrl: `https://storage.test/${PICTURE_PATH}`,
      imageThumbnailUrl: null,
    })
    expect(steps).toEqual([`upload ${PICTURE_PATH}`, `delete ${THUMBNAIL_PATH}`])
  })

  test('still answers once the picture is up, when the previous thumbnail cannot be deleted either', async () => {
    thumbnail = null
    deleteFailure = new Error('Network down')

    expect(await uploadProfilePicture('someone', PICTURE)).toEqual({
      imageUrl: `https://storage.test/${PICTURE_PATH}`,
      imageThumbnailUrl: null,
    })
  })

  test('throws when the picture fails to go up, and leaves the thumbnail as it was', async () => {
    uploadFailures[PICTURE_PATH] = new Error('Network down')

    await expect(uploadProfilePicture('someone', PICTURE)).rejects.toThrow('Network down')
    expect(steps).toEqual([`upload ${PICTURE_PATH}`])
  })
})
