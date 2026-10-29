import {
  DAILY_CAP_WINDOW_HOURS,
  MAX_DAILY_RECEIPT_READS_PER_MEMBER,
  MAX_DAILY_RECEIPT_READS_PER_ORGANIZATION,
} from 'strategydance-core'
import { getBillReceiptReads } from 'strategydance-database/backend'

import type { ReachedUsageCap } from '~types'

import { IS_USAGE_CAPPED } from '~constants'

import { dataConnect } from '~firebase'

const WINDOW_MS = DAILY_CAP_WINDOW_HOURS * 60 * 60 * 1000

type BillReceiptReadReference = {
  organizationId: string
  userId: string
  // The receipt asked for, which its own claim never counts
  receiptId: string
}

/*
  The receipt reader's daily cap a read reaches, the member's in the organization or the
  organization's, or null while both have room, from the reads `ClaimBillReceiptRead` counts: before
  the claim, so a read at its cap is refused before anything is written, and again once the claim was
  refused, to tell the cap from a read under way. Only the newest rows say when a cap has room, the
  one as many rows back as it allows, once it is 24 hours old, as `findReachedUsageCap` reads the
  starts'. Of the two, the one that has room last. Null wherever the caps are lifted, on the
  development backend
*/
async function readReachedReceiptReadCap(
  { organizationId, userId, receiptId }: BillReceiptReadReference,
  now = Date.now(),
): Promise<ReachedUsageCap | null> {
  if (!IS_USAGE_CAPPED) return null

  const { data } = await getBillReceiptReads(dataConnect, { organizationId, userId, receiptId })
  const caps = [
    { scope: 'member', max: MAX_DAILY_RECEIPT_READS_PER_MEMBER, newest: data.memberReads },
    { scope: 'organization', max: MAX_DAILY_RECEIPT_READS_PER_ORGANIZATION, newest: data.organizationReads },
  ] as const
  let reached: ReachedUsageCap | null = null

  for (const { scope, max, newest } of caps) {
    const oldest = newest[max - 1]?.readAt

    if (!oldest) continue

    const retryAfterMs = Math.max(0, Date.parse(oldest) + WINDOW_MS - now)

    if (!reached || retryAfterMs > reached.retryAfterMs) reached = { kind: 'receiptReads', scope, max, retryAfterMs }
  }

  return reached
}

export default readReachedReceiptReadCap
