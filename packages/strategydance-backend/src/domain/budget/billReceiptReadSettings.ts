import { MAX_BILL_RECEIPT_TEXT_LENGTH } from 'strategydance-core'

/* ---
  What the receipt reader's request sends (`buildBillReceiptReadRequest`), and how long a read may
  take, as documents/budget.md § Reading a receipt settles it
--- */

/*
  The model it asks, as David chose on 2026-10-24: reading a receipt's few fields needs no Opus, and
  the member waits on it with the bill dialog's upload open. It has no server-side fallback, so a
  refusal is a read that failed, which the member can ask again
*/
export const BILL_RECEIPT_READ_MODEL = 'claude-haiku-5-5'

/*
  Its thinking, which counts toward it, and its answer, a handful of short fields, fit inside it at
  low effort, as the claude-api skill sizes a short answer on Haiku 5.5. An answer cut at it is a
  read that failed
*/
export const BILL_RECEIPT_READ_MAX_TOKENS = 1024

// How long the request may take before the read gives up and lets the receipt go
export const BILL_RECEIPT_READ_TIMEOUT_MS = 60 * 1000

/*
  How many of a text receipt's bytes a read takes from Storage: enough for the 50000 characters it
  sends (`MAX_BILL_RECEIPT_TEXT_LENGTH`), four bytes each at most in UTF-8, rather than the up to
  10 MiB a text receipt may hold, which a read holding it whole as characters would take hundreds of
  MB for
*/
export const MAX_BILL_RECEIPT_TEXT_READ_BYTES = 4 * MAX_BILL_RECEIPT_TEXT_LENGTH

/*
  How long after its claim a read that stored nothing can be claimed again, which only a backend
  that stopped mid-read leaves: twice the request's timeout, so a read under way is never taken
  over. Written out again in `ClaimBillReceiptRead`, which cannot import it: change them together
*/
export const BILL_RECEIPT_READ_CLAIM_MS = 2 * 60 * 1000

/*
  The largest photo the reader sends, in bytes: Claude reads an image of 5 MB at most, counted on
  its base64, which is four thirds of its bytes. The page fits a photo far below it, so only an
  upload made outside the page reaches it
*/
export const MAX_BILL_RECEIPT_READ_IMAGE_SIZE = (5 * 1024 * 1024 * 3) / 4
