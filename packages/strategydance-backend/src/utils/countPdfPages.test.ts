import { describe, expect, it } from 'bun:test'

import { PDFDocument } from 'pdf-lib'

import countPdfPages from './countPdfPages'

async function buildPdf(pageCount: number, { useObjectStreams = true } = {}) {
  const document = await PDFDocument.create()

  for (let index = 0; index < pageCount; index++) document.addPage()

  return document.save({ useObjectStreams })
}

// A PDF whose trailer names an encryption dictionary, as a password-protected one does
function buildEncryptedPdf() {
  return new TextEncoder().encode(
    [
      '%PDF-1.7',
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj',
      '3 0 obj << /Filter /Standard /V 2 /R 3 /O (x) /U (x) /P -4 >> endobj',
      'trailer << /Root 1 0 R /Encrypt 3 0 R /Size 4 >>',
      '%%EOF',
    ].join('\n'),
  )
}

describe('countPdfPages', () => {
  it('counts the pages of a PDF, with and without object streams', async () => {
    expect(await countPdfPages(await buildPdf(3))).toEqual({ outcome: 'counted', pageCount: 3 })
    expect(await countPdfPages(await buildPdf(101, { useObjectStreams: false }))).toEqual({
      outcome: 'counted',
      pageCount: 101,
    })
  })

  it('refuses an encrypted PDF', async () => {
    expect(await countPdfPages(buildEncryptedPdf())).toEqual({ outcome: 'encrypted' })
  })

  it('finds no pages in what is no PDF', async () => {
    expect(await countPdfPages(new TextEncoder().encode('Hello'))).toEqual({ outcome: 'unreadable' })
  })
})
