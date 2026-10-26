import { describe, expect, test } from 'bun:test'

import { PDFDocument } from 'pdf-lib'

import checkBillReceiptBytes from './checkBillReceiptBytes'

async function pdf(pageCount: number) {
  const document = await PDFDocument.create()

  for (let index = 0; index < pageCount; index++) document.addPage()

  return document.save()
}

describe('checkBillReceiptBytes', () => {
  test('takes a PDF of up to 20 pages and refuses a longer one, or one it cannot read', async () => {
    expect(await checkBillReceiptBytes(await pdf(20), 'application/pdf')).toEqual({ outcome: 'checked' })
    expect(await checkBillReceiptBytes(await pdf(21), 'application/pdf')).toMatchObject({ outcome: 'tooLarge' })
    expect(await checkBillReceiptBytes(new TextEncoder().encode('%PDF-1.7 torn'), 'application/pdf')).toMatchObject({
      outcome: 'unsupported',
    })
  })

  test('takes text of any length in UTF-8, and refuses other bytes or a NUL', async () => {
    const encoder = new TextEncoder()

    expect(await checkBillReceiptBytes(encoder.encode('Total: 12,00 €\n'.repeat(10000)), 'text/csv')).toEqual({
      outcome: 'checked',
    })
    expect(await checkBillReceiptBytes(new Uint8Array([0xff, 0xfe, 0x41]), 'text/plain')).toMatchObject({
      outcome: 'unsupported',
    })
    expect(await checkBillReceiptBytes(encoder.encode('Total\u0000'), 'text/markdown')).toMatchObject({
      outcome: 'unsupported',
    })
  })

  test('takes a photo on the signature its upload checked', async () => {
    expect(await checkBillReceiptBytes(new Uint8Array([0xff, 0xd8, 0xff]), 'image/jpeg')).toEqual({
      outcome: 'checked',
    })
  })
})
