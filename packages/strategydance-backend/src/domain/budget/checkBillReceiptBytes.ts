import { MAX_BILL_RECEIPT_PDF_PAGES } from 'strategydance-core'

import countPdfPages from '~utils/countPdfPages'

type BillReceiptBytesCheck =
  | { outcome: 'checked' }
  | { outcome: 'unsupported'; reason: string }
  | { outcome: 'tooLarge'; reason: string }

/*
  Whether a stored receipt is what its type says, past the first bytes its upload sniffed: a PDF its
  parser reads, unencrypted, of at most 20 pages, and text that is UTF-8 and holds no NUL, however
  long, since whoever reads it cuts it at `MAX_BILL_RECEIPT_TEXT_LENGTH`. A photo is taken on its
  signature, which the upload checked
*/
async function checkBillReceiptBytes(bytes: Uint8Array, contentType: string): Promise<BillReceiptBytesCheck> {
  if (contentType.startsWith('image/')) return { outcome: 'checked' }

  if (contentType === 'application/pdf') {
    const pages = await countPdfPages(bytes)

    if (pages.outcome === 'encrypted') return { outcome: 'unsupported', reason: 'The PDF is protected by a password' }
    if (pages.outcome === 'unreadable') return { outcome: 'unsupported', reason: 'The PDF cannot be read' }

    if (pages.pageCount > MAX_BILL_RECEIPT_PDF_PAGES) {
      return { outcome: 'tooLarge', reason: `A receipt's PDF has at most ${MAX_BILL_RECEIPT_PDF_PAGES} pages` }
    }

    return { outcome: 'checked' }
  }

  let text: string

  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return { outcome: 'unsupported', reason: 'The text is not UTF-8' }
  }

  if (text.includes('\u0000')) return { outcome: 'unsupported', reason: 'The file is not text' }

  return { outcome: 'checked' }
}

export default checkBillReceiptBytes
