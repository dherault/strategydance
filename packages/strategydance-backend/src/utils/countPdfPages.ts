import { PDFDocument } from 'pdf-lib'

type PdfPageCount =
  | { outcome: 'counted'; pageCount: number }
  // Protected by a password, which Claude does not read either
  | { outcome: 'encrypted' }
  // Not a PDF its parser can read
  | { outcome: 'unreadable' }

/*
  How many pages a PDF has, counted once from its page tree when it is stored, so a conversation's
  pages are summed from what was kept without parsing a file again. `pdf-lib` reads cross-reference
  streams and object streams. An encrypted file, which Claude refuses too, is read anyway and told
  apart by what the document says of itself, since `pdf-lib`'s own error classes are not reliably
  told apart by `instanceof`
*/
async function countPdfPages(bytes: Uint8Array): Promise<PdfPageCount> {
  let document: PDFDocument

  try {
    document = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })
  } catch {
    return { outcome: 'unreadable' }
  }

  if (document.isEncrypted) return { outcome: 'encrypted' }

  try {
    return { outcome: 'counted', pageCount: document.getPageCount() }
  } catch {
    return { outcome: 'unreadable' }
  }
}

export default countPdfPages
