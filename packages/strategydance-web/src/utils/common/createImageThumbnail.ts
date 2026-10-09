import { THUMBNAIL_SIZE } from 'strategydance-core'

import getThumbnailSize from '~utils/common/getThumbnailSize'

/*
  A picture fitted inside a square of `THUMBNAIL_SIZE` pixels, for where it is drawn small, as a
  WebP, which keeps a logo's transparency, or a PNG from a browser that writes no WebP. An animated
  GIF keeps its first frame, and a photo turned by its EXIF data stays turned, since
  `createImageBitmap` reads it.

  Null when the browser cannot draw one, as for a picture too large for it to decode, and the
  failure is logged: the picture then goes up alone, and is drawn wherever its thumbnail would be
*/
async function createImageThumbnail(image: Blob) {
  let bitmap: ImageBitmap | null = null

  try {
    bitmap = await createImageBitmap(image)

    const { width, height } = getThumbnailSize(bitmap, THUMBNAIL_SIZE)
    const canvas = document.createElement('canvas')

    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')

    if (!context) throw new Error('The browser gave no 2D context to draw the thumbnail on')

    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, width, height)

    const thumbnail = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.9))

    if (!thumbnail) throw new Error('The browser could not encode the thumbnail')

    return thumbnail
  } catch (error) {
    console.error('Failed to draw a thumbnail of the picture', error)

    return null
  } finally {
    bitmap?.close()
  }
}

export default createImageThumbnail
