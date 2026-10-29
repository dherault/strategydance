import { describe, expect, test } from 'bun:test'

import { Currency } from 'strategydance-core'

import BILL_RECEIPT_READ_PROMPT from './billReceiptReadPrompt'
import buildBillReceiptReadRequest, { BILL_RECEIPT_READ_SCHEMA } from './buildBillReceiptReadRequest'

const TODAY = '2026-10-27'

function build(file: { name: string; contentType: string; bytes: Uint8Array }) {
  return buildBillReceiptReadRequest({ file, today: TODAY, organizationName: 'Acme Studio' })
}

function readContent(request: ReturnType<typeof buildBillReceiptReadRequest>) {
  const [message] = request.messages

  return Array.isArray(message?.content) ? message.content : []
}

const bytes = new TextEncoder().encode('%PDF-1.7 an invoice')

describe('buildBillReceiptReadRequest', () => {
  test('asks Haiku 5.5 at low effort for the fields, held to its schema, with no tools and no fallback', () => {
    const request = build({ name: 'invoice.pdf', contentType: 'application/pdf', bytes })

    expect(request).toMatchObject({
      model: 'claude-haiku-5-5',
      max_tokens: 1024,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: BILL_RECEIPT_READ_SCHEMA } },
      system: BILL_RECEIPT_READ_PROMPT,
    })
    expect(request).not.toHaveProperty('fallbacks')
    expect(request).not.toHaveProperty('betas')
    expect(request).not.toHaveProperty('tools')
    expect(request).not.toHaveProperty('thinking')
    expect(request.messages).toHaveLength(1)
  })

  test('lists every currency and recurrence a bill takes, each field required', () => {
    const { properties, required } = BILL_RECEIPT_READ_SCHEMA

    expect(properties.currency.anyOf[0]).toEqual({ type: 'string', enum: Object.values(Currency) })
    expect(properties.recurrence.anyOf[0]).toEqual({
      type: 'string',
      enum: ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'],
    })
    expect(required).toEqual(Object.keys(properties))
  })

  test('sends a PDF whole as a document, then today, the organization and the file’s name', () => {
    const request = build({ name: 'invoice.pdf', contentType: 'application/pdf', bytes })

    expect(JSON.stringify(request.messages)).toBe(
      JSON.stringify([
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: Buffer.from(bytes).toString('base64') },
              title: 'invoice.pdf',
            },
            {
              type: 'text',
              text: [
                'Today is 2026-10-27.',
                'The company the receipt belongs to, which paid it: Acme Studio',
                "The file's name: invoice.pdf",
              ].join('\n'),
            },
          ],
        },
      ]),
    )
  })

  test('sends a photo as an image', () => {
    const photo = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
    const [block] = readContent(build({ name: 'receipt.jpg', contentType: 'image/jpeg', bytes: photo }))

    expect(block).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: Buffer.from(photo).toString('base64') },
    })
  })

  test('holds back a character a read cut inside, rather than send a replacement for it', () => {
    // Three of the four bytes of the receipt emoji, as a read stopping short of it leaves them
    const cut = new Uint8Array([
      ...new TextEncoder().encode('Total 12.00 '),
      ...new TextEncoder().encode('🧾').subarray(0, 3),
    ])
    const [block] = readContent(build({ name: 'receipt.txt', contentType: 'text/plain', bytes: cut }))

    expect(block).toMatchObject({ source: { data: 'Total 12.00 ' } })
  })

  test('sends a text file as plain text, cut at 50000 characters, never inside one', () => {
    const long = new TextEncoder().encode('🧾'.repeat(50001))
    const [block] = readContent(build({ name: 'receipt.md', contentType: 'text/markdown', bytes: long }))

    expect(block).toEqual({
      type: 'document',
      source: { type: 'text', media_type: 'text/plain', data: '🧾'.repeat(50000) },
      title: 'receipt.md',
    })

    const [short] = readContent(
      build({ name: 'receipt.txt', contentType: 'text/plain', bytes: new TextEncoder().encode('Total 12.00') }),
    )

    expect(short).toMatchObject({ source: { type: 'text', data: 'Total 12.00' } })
  })
})

describe('BILL_RECEIPT_READ_PROMPT', () => {
  test('asks for every field of the schema, and holds no em dash', () => {
    for (const field of BILL_RECEIPT_READ_SCHEMA.required) expect(BILL_RECEIPT_READ_PROMPT).toContain(`- ${field}: `)

    expect(BILL_RECEIPT_READ_PROMPT).not.toContain('—')
    expect(BILL_RECEIPT_READ_PROMPT).not.toMatch(/[ \t]$/m)
  })
})
