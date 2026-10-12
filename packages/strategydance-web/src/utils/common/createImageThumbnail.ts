import { THUMBNAIL_SIZE } from 'strategydance-core'

import drawImageInside from '~utils/common/drawImageInside'

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

    return await drawImageInside(bitmap, THUMBNAIL_SIZE, 'image/webp', 0.9)
  } catch (error) {
    console.error('Failed to draw a thumbnail of the picture', error)

    return null
  } finally {
    bitmap?.close()
  }
}

export default createImageThumbnail
