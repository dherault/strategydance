import sniffImageContentType from '~utils/sniffImageContentType'

// How a PDF starts
const PDF_SIGNATURE = '%PDF-'

// How a ZIP starts, which an Office document is: text it is not, whatever its name
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]

/*
  Whether a file's first bytes are what its upload says it is, as a conversation's files are read
  off their bytes rather than off the request that carried them: an image's signature has to be the
  type declared, a PDF has to start as one, and a text file must carry no image's, PDF's or ZIP's
  signature and no NUL byte, which no text holds. A text file is decoded whole once stored, which
  refuses what is no UTF-8
*/
function sniffConversationAttachment(bytes: Uint8Array, contentType: string) {
  const image = sniffImageContentType(bytes)

  if (contentType.startsWith('image/')) return image === contentType

  const isPdf = String.fromCharCode(...bytes.subarray(0, PDF_SIGNATURE.length)) === PDF_SIGNATURE

  if (contentType === 'application/pdf') return isPdf

  const isZip = ZIP_SIGNATURE.every((byte, index) => bytes[index] === byte)

  return !image && !isPdf && !isZip && !bytes.includes(0)
}

export default sniffConversationAttachment
