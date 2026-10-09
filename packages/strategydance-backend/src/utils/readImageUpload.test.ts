import { describe, expect, test } from 'bun:test'

import { MAX_THUMBNAIL_SIZE } from 'strategydance-core'

import readImageUpload from './readImageUpload'

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
const WEBP = Buffer.from('RIFF\x24\x00\x00\x00WEBPVP8 ', 'latin1')
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')

const MAX_SIZE = 1024

/*
  A form as a browser sends it: its bytes, and the header naming its boundary. The header is read
  before the body, since Bun draws a new boundary for a header read after
*/
async function encodeForm(parts: Record<string, Buffer | string>) {
  const form = new FormData()

  Object.entries(parts).forEach(([name, value]) => {
    if (typeof value === 'string') form.append(name, value)
    else form.append(name, new Blob([new Uint8Array(value)]), name)
  })

  const request = new Request('http://localhost', { method: 'PUT', body: form })
  const contentType = request.headers.get('content-type') ?? ''

  return { body: Buffer.from(await request.arrayBuffer()), contentType }
}

describe('readImageUpload', () => {
  test('reads a picture sent as its own bytes, with no thumbnail, as a page from before thumbnails sends it', async () => {
    expect(await readImageUpload({ body: PNG, contentType: 'image/png', maxSize: MAX_SIZE })).toEqual({
      outcome: 'read',
      image: { bytes: PNG, contentType: 'image/png' },
      thumbnail: null,
    })
  })

  test('reads each file of a form off its bytes, whatever the request called them', async () => {
    const form = await encodeForm({ image: PNG, thumbnail: WEBP })

    expect(await readImageUpload({ ...form, maxSize: MAX_SIZE })).toEqual({
      outcome: 'read',
      image: { bytes: PNG, contentType: 'image/png' },
      thumbnail: { bytes: WEBP, contentType: 'image/webp' },
    })
  })

  test('reads a form with no thumbnail, as the page sends one it could not draw a thumbnail for', async () => {
    const form = await encodeForm({ image: PNG })

    expect(await readImageUpload({ ...form, maxSize: MAX_SIZE })).toEqual({
      outcome: 'read',
      image: { bytes: PNG, contentType: 'image/png' },
      thumbnail: null,
    })
  })

  test('refuses an SVG, sent alone or as either file of a form', async () => {
    expect(await readImageUpload({ body: SVG, contentType: 'image/png', maxSize: MAX_SIZE })).toEqual({
      outcome: 'unsupported',
    })
    expect(await readImageUpload({ ...(await encodeForm({ image: SVG })), maxSize: MAX_SIZE })).toEqual({
      outcome: 'unsupported',
    })
    expect(await readImageUpload({ ...(await encodeForm({ image: PNG, thumbnail: SVG })), maxSize: MAX_SIZE })).toEqual(
      { outcome: 'unsupported' },
    )
  })

  test('refuses a form with no picture, or with text where a file goes', async () => {
    expect(await readImageUpload({ ...(await encodeForm({ thumbnail: PNG })), maxSize: MAX_SIZE })).toEqual({
      outcome: 'unsupported',
    })
    expect(await readImageUpload({ ...(await encodeForm({ image: 'PNG' })), maxSize: MAX_SIZE })).toEqual({
      outcome: 'unsupported',
    })
    expect(
      await readImageUpload({ ...(await encodeForm({ image: PNG, thumbnail: 'PNG' })), maxSize: MAX_SIZE }),
    ).toEqual({ outcome: 'unsupported' })
  })

  test('refuses a form that does not parse, and a body the parser left unread', async () => {
    const { contentType } = await encodeForm({ image: PNG })

    expect(await readImageUpload({ body: Buffer.from('garbage'), contentType, maxSize: MAX_SIZE })).toEqual({
      outcome: 'unsupported',
    })
    expect(await readImageUpload({ body: {}, contentType: 'text/plain', maxSize: MAX_SIZE })).toEqual({
      outcome: 'unsupported',
    })
  })

  test('holds the picture and its thumbnail each to its own ceiling', async () => {
    const largePicture = Buffer.concat([PNG, Buffer.alloc(MAX_SIZE)])
    const largeThumbnail = Buffer.concat([WEBP, Buffer.alloc(MAX_THUMBNAIL_SIZE)])

    expect(await readImageUpload({ body: largePicture, contentType: 'image/png', maxSize: MAX_SIZE })).toEqual({
      outcome: 'too-large',
    })
    expect(await readImageUpload({ ...(await encodeForm({ image: largePicture })), maxSize: MAX_SIZE })).toEqual({
      outcome: 'too-large',
    })
    expect(
      await readImageUpload({ ...(await encodeForm({ image: PNG, thumbnail: largeThumbnail })), maxSize: MAX_SIZE }),
    ).toEqual({ outcome: 'too-large' })
  })
})
