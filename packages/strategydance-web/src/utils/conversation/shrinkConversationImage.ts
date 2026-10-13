import { MAX_CONVERSATION_IMAGE_SIZE } from 'strategydance-core'

import { CONVERSATION_IMAGE_LONG_SIDE, CONVERSATION_IMAGE_QUALITY } from '~constants'

import drawImageInside from '~utils/common/drawImageInside'

// The images the browser draws again: a GIF is left as it is, since drawing it keeps one frame
const SHRUNK_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// Whether the browser shrinks a file of this type before it goes up, so its size before says nothing
export function isShrunkConversationImage(contentType: string) {
  return SHRUNK_TYPES.includes(contentType)
}

/*
  An image as it goes to a conversation: no longer than `CONVERSATION_IMAGE_LONG_SIDE` on its long
  side, which Claude reads it at anyway, and in its own type, so a screenshot stays sharp. One that
  is still over what Claude takes goes as a JPEG. A photo turned by its EXIF data comes out turned,
  since `createImageBitmap` reads it.

  Any other file, an image that needs nothing, and one the browser cannot draw go as they are: the
  backend checks what Claude takes whatever the browser did, so the shrinking is a convenience
*/
async function shrinkConversationImage(file: Blob, contentType: string): Promise<Blob> {
  if (!isShrunkConversationImage(contentType)) return file

  let bitmap: ImageBitmap | null = null

  try {
    bitmap = await createImageBitmap(file)

    const isLong = Math.max(bitmap.width, bitmap.height) > CONVERSATION_IMAGE_LONG_SIDE

    if (!isLong && file.size <= MAX_CONVERSATION_IMAGE_SIZE) return file

    const shrunk = await drawImageInside(bitmap, CONVERSATION_IMAGE_LONG_SIDE, contentType, CONVERSATION_IMAGE_QUALITY)

    if (shrunk.size <= MAX_CONVERSATION_IMAGE_SIZE) return shrunk

    return await drawImageInside(bitmap, CONVERSATION_IMAGE_LONG_SIDE, 'image/jpeg', CONVERSATION_IMAGE_QUALITY)
  } catch (error) {
    console.error('The image could not be shrunk, and goes as it is', error)

    return file
  } finally {
    bitmap?.close()
  }
}

export default shrinkConversationImage
