import type { BillReceiptFile } from '~types'

// A receipt's bytes as its dialog draws them: a text file's text read out of them, decoded as the
// UTF-8 the backend holds every text receipt to
async function readBillReceiptFile(blob: Blob): Promise<BillReceiptFile> {
  return { blob, text: blob.type.startsWith('text/') ? await blob.text() : null }
}

export default readBillReceiptFile
