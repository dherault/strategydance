import getThumbnailSize from '~utils/common/getThumbnailSize'

/*
  A picture drawn again fitted inside a square of `maxSize` pixels, never enlarged, encoded as
  `type` at `quality` where the type takes one. A JPEG, which has no transparency, is drawn on
  white rather than on black. A browser that cannot encode the type answers a PNG instead, which
  the blob's own type says.

  Throws when the browser cannot draw it
*/
async function drawImageInside(bitmap: ImageBitmap, maxSize: number, type: string, quality?: number) {
  const { width, height } = getThumbnailSize(bitmap, maxSize)
  const canvas = document.createElement('canvas')

  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')

  if (!context) throw new Error('The browser gave no 2D context to draw the picture on')

  if (type === 'image/jpeg') {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
  }

  context.imageSmoothingQuality = 'high'
  context.drawImage(bitmap, 0, 0, width, height)

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality))

  if (!blob) throw new Error('The browser could not encode the picture')

  return blob
}

export default drawImageInside
