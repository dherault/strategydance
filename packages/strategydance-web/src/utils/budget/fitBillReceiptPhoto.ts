import { BILL_RECEIPT_PHOTO_LONG_SIDE, BILL_RECEIPT_PHOTO_QUALITY } from '~constants'

import drawImageInside from '~utils/common/drawImageInside'

// The photos the browser draws again
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/*
  A receipt as it goes up: a photo fitted within `BILL_RECEIPT_PHOTO_LONG_SIDE` on its long side,
  as a JPEG, named so, which Claude reads it at and well under its 5 MB. A JPEG that fits already
  goes as it is, and so do a PDF, a text file and a photo the browser cannot draw, since the
  backend checks the file whatever the browser did. A photo turned by its EXIF data comes out
  turned, since `createImageBitmap` reads it
*/
async function fitBillReceiptPhoto(file: File, contentType: string): Promise<File> {
  if (!PHOTO_TYPES.includes(contentType)) return file

  let bitmap: ImageBitmap | null = null

  try {
    bitmap = await createImageBitmap(file)

    if (contentType === 'image/jpeg' && Math.max(bitmap.width, bitmap.height) <= BILL_RECEIPT_PHOTO_LONG_SIDE) {
      return file
    }

    const fitted = await drawImageInside(bitmap, BILL_RECEIPT_PHOTO_LONG_SIDE, 'image/jpeg', BILL_RECEIPT_PHOTO_QUALITY)
    const extension = fitted.type === 'image/jpeg' ? 'jpg' : 'png'

    return new File([fitted], `${file.name.replace(/\.[^.]*$/, '')}.${extension}`, { type: fitted.type })
  } catch (error) {
    console.error('The photo could not be fitted, and goes as it is', error)

    return file
  } finally {
    bitmap?.close()
  }
}

export default fitBillReceiptPhoto
