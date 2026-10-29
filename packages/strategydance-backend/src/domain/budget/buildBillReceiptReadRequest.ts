import type { BetaMessageParam, BetaMessageStreamParams } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { BILL_RECURRENCES, Currency, MAX_BILL_RECEIPT_TEXT_LENGTH } from 'strategydance-core'

import buildConversationAttachmentBlock from '~domain/agent/buildConversationAttachmentBlock'
import BILL_RECEIPT_READ_PROMPT from '~domain/budget/billReceiptReadPrompt'
import { BILL_RECEIPT_READ_MAX_TOKENS, BILL_RECEIPT_READ_MODEL } from '~domain/budget/billReceiptReadSettings'

type BillReceiptReadInput = {
  // The receipt as stored: its name, one of `BILL_RECEIPT_CONTENT_TYPES`, and its bytes
  file: { name: string; contentType: string; bytes: Uint8Array }
  // The member's today, `YYYY-MM-DD`, which a day written without a year resolves against
  today: string
  // The organization the receipt belongs to, which paid it, so the model tells it from the seller
  organizationName: string
}

function nullable(schema: Record<string, unknown>) {
  return { anyOf: [schema, { type: 'null' }] }
}

/*
  What the answer holds, every field required, those the receipt may not show null. The API takes
  no bound on a string's length, so `readBillReceiptFields` clamps them to a bill's
*/
export const BILL_RECEIPT_READ_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'A short label for the expense' },
    description: { type: 'string', description: 'One short line on what it was for, or an empty string' },
    company: { type: 'string', description: 'The seller, the company that was paid' },
    amount: nullable({ type: 'string', description: 'The total paid, such as 1500.00' }),
    currency: nullable({ type: 'string', enum: Object.values(Currency) }),
    paidOn: nullable({ type: 'string', format: 'date' }),
    recurrence: nullable({ type: 'string', enum: BILL_RECURRENCES }),
  },
  required: ['name', 'description', 'company', 'amount', 'currency', 'paidOn', 'recurrence'],
  additionalProperties: false,
}

/*
  The request that reads a bill's receipt for the upload dialog: Haiku 5.5 at low effort
  (`BILL_RECEIPT_READ_MODEL`), with no fallback, which the API offers none of for it, no tools, and
  its answer held to a schema (structured output), which `readBillReceiptFields` reads.

  The file goes in whole as its own block, since one request reads it once: a PDF as a document, a
  photo as an image, and a text file as a plain text document cut at 50000 characters
  (`MAX_BILL_RECEIPT_TEXT_LENGTH`), between two of them. Then come today, the organization's name and
  the file's name, which the system prompt says how to read
*/
function buildBillReceiptReadRequest({ file, today, organizationName }: BillReceiptReadInput): BetaMessageStreamParams {
  const bytes = file.contentType.startsWith('text/') ? cutText(file.bytes) : file.bytes
  const text = [
    `Today is ${today}.`,
    `The company the receipt belongs to, which paid it: ${organizationName}`,
    `The file's name: ${file.name}`,
  ].join('\n')

  return {
    model: BILL_RECEIPT_READ_MODEL,
    max_tokens: BILL_RECEIPT_READ_MAX_TOKENS,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: BILL_RECEIPT_READ_SCHEMA } },
    system: BILL_RECEIPT_READ_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          buildConversationAttachmentBlock(file, { bytes }),
          { type: 'text', text },
        ] as BetaMessageParam['content'],
      },
    ],
  }
}

/*
  A text file's bytes to 50000 characters at most, as UTF-8, which its upload checked it is. The read
  may have cut the bytes inside a character, whose start a streaming decode holds back rather than
  write as a replacement character
*/
function cutText(bytes: Uint8Array) {
  const characters = Array.from(new TextDecoder().decode(bytes, { stream: true }))

  return new TextEncoder().encode(characters.slice(0, MAX_BILL_RECEIPT_TEXT_LENGTH).join(''))
}

export default buildBillReceiptReadRequest
