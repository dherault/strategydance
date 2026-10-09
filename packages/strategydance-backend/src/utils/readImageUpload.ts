import { MAX_THUMBNAIL_SIZE } from 'strategydance-core'

import sniffImageContentType from '~utils/sniffImageContentType'

// A picture as the backend stores it: its bytes, and the type read off them
export type ImageFile = {
  bytes: Buffer
  contentType: string
}

type ReadImageUploadInput = {
  // What `express.raw` buffered: a `Buffer` when the request was of a type it takes
  body: unknown
  // The request's own header, which says whether the body is a form, and where its parts end
  contentType: string | undefined
  // In bytes, for the picture. Its thumbnail's ceiling is `MAX_THUMBNAIL_SIZE`
  maxSize: number
}

type ReadImageUploadResult =
  | { outcome: 'unsupported' }
  | { outcome: 'too-large' }
  | { outcome: 'read'; image: ImageFile; thumbnail: ImageFile | null }

// One file of the upload, or null when it is not one of the pictures accepted or not there at all
async function readImageFile(value: Blob | string | Buffer | null): Promise<ImageFile | null> {
  if (value === null || typeof value === 'string') return null

  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(await value.arrayBuffer())
  const contentType = sniffImageContentType(bytes)

  return contentType ? { bytes, contentType } : null
}

/*
  The picture a request carries, with its thumbnail when it has one, out of the body `express.raw`
  buffered. Either the picture's own bytes, as a page from before thumbnails sends it, or a form of
  two files: `image`, and `thumbnail` beside it, which may be missing, as it is when the page could
  not draw one.

  Each file's type is read off its bytes, never off the request or the form, and each is held to
  its own ceiling, since the parser's limit counts the two together
*/
async function readImageUpload({ body, contentType, maxSize }: ReadImageUploadInput): Promise<ReadImageUploadResult> {
  if (!Buffer.isBuffer(body)) return { outcome: 'unsupported' }

  if (!contentType?.toLowerCase().startsWith('multipart/form-data')) {
    if (body.length > maxSize) return { outcome: 'too-large' }

    const image = await readImageFile(body)

    return image ? { outcome: 'read', image, thumbnail: null } : { outcome: 'unsupported' }
  }

  // Null for a form that does not parse, as one missing its boundary or its end
  const form = await new Response(body, { headers: { 'Content-Type': contentType } }).formData().catch(() => null)

  if (!form) return { outcome: 'unsupported' }

  const imageValue = form.get('image')
  const thumbnailValue = form.get('thumbnail')

  if (imageValue instanceof Blob && imageValue.size > maxSize) return { outcome: 'too-large' }
  if (thumbnailValue instanceof Blob && thumbnailValue.size > MAX_THUMBNAIL_SIZE) return { outcome: 'too-large' }

  const image = await readImageFile(imageValue)
  const thumbnail = await readImageFile(thumbnailValue)

  if (!image || (thumbnailValue !== null && !thumbnail)) return { outcome: 'unsupported' }

  return { outcome: 'read', image, thumbnail }
}

export default readImageUpload
