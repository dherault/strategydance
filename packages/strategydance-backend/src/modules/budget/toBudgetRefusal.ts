import { MAX_BILLS } from 'strategydance-core'

import type { BudgetRefusal } from '~types'

import toToolRefusal from '~modules/toToolRefusal'
import toTooManySearchesSentence from '~modules/toTooManySearchesSentence'

// A refusal of the Budget module's, as a tool result whose sentence the model can act on
function toBudgetRefusal(refusal: BudgetRefusal) {
  return toToolRefusal(toSentence(refusal))
}

function toSentence(refusal: BudgetRefusal) {
  switch (refusal.outcome) {
    case 'notMember':
      return 'The member is no longer in this organization, so its budget is closed to you.'
    case 'readOnly':
      return 'This connection may only read the budget. Ask the member to connect again with write access to change bills.'
    case 'fromReaction':
      return "This run reacts to subagents' reports, and deletes nothing. Ask the member with ask_user whether the bill should go: the run their answer starts can delete it."
    case 'notFound':
      return 'No bill has that id. List the bills to find it: a deleted bill is not listed.'
    case 'payerNotMember':
      return 'That person is not a member of the organization. Name a member as member:<id>, as a bill lists its payer, or "me".'
    case 'payerRequired':
      return "The bill's payer has left with their account. Name who pays it now with paidBy."
    case 'full':
      return `The organization keeps ${MAX_BILLS} bills, the most it may. Tell the member, who can delete one first.`
    case 'changed':
      return 'The bill changed since you read it. Read it again first.'
    case 'busy':
      return 'The bill kept changing while you changed it. Read it again, then try once more.'
    case 'invalidField':
      return `${refusal.reason}.`
    case 'invalidReceipt':
      return `${refusal.reason}. Nothing was written.`
    case 'attachmentUnavailable':
      return 'A receipt by attachmentId is a file the member sent in a conversation, which this connection has none of. Hand the receipt over as base64 or as text.'
    case 'attachmentNotFound':
      return 'No file the member sent in this conversation, nor one your brief hands you, has that id. Name a file by the id its line gives, as name (attachment <id>), or hand the receipt over as base64 or as text.'
    case 'receiptTaken':
      return 'Another bill took that receipt meanwhile. Send the receipt again with this call, and it is stored anew.'
    case 'earlierReceiptNotFound':
      return "That id is none of the bill's earlier receipts. Read the bill: read_bill lists them under earlierReceipts."
    case 'notDeleted':
      return 'The bill is not deleted, so there is nothing to restore.'
    case 'goneForGood':
      return 'The bill was deleted over a day ago and is gone for good.'
    case 'keyConflict':
      return 'That idempotency key was sent before with another call. Send a new key with each new call.'
    case 'invalidCursor':
      return 'That cursor is not one this tool gave. Start again without it.'
    case 'tooManySearches':
      return toTooManySearchesSentence(refusal.retryAfterMs, 'call list_bills without a query')
  }
}

export default toBudgetRefusal
