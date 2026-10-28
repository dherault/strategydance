import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'

import { completeBillReceiptUpload, reserveBillReceiptForAgent } from 'strategydance-database/backend'

import type { ModuleCaller } from '~types'

import { dataConnect } from '~firebase'

import buildBillReceiptObjectName from '~utils/buildBillReceiptObjectName'
import toCanonicalUuid from '~utils/toCanonicalUuid'

import billReceiptStorage from '~domain/budget/billReceiptStorage'
import type { AgentBillReceiptFile } from '~domain/budget/readAgentBillReceipt'
import isOperationRefusal from '~domain/modules/isOperationRefusal'
import { NOT_MEMBER_REFUSAL } from '~domain/modules/moduleRefusalMessages'

type WriteAgentBillReceiptResult = { outcome: 'written'; receiptId: string } | { outcome: 'notMember' }

/*
  Stores a receipt an agent handed over, checked already by `readAgentBillReceipt`, as the page's
  upload stores one: its row first, `UPLOADING`, under a new id, then its file, create-only, where it
  stays, then the row `READY`, which a bill's write then takes. A write the call's key answers later
  leaves a receipt nothing holds, which the daily sweep prunes two days after, as it prunes an upload
  never saved.

  Imported only by a call carrying a receipt, since it reaches the bucket, which a module's tests do
  not load
*/
async function writeAgentBillReceipt(
  caller: ModuleCaller,
  { name, contentType, bytes }: AgentBillReceiptFile,
): Promise<WriteAgentBillReceiptResult> {
  const receiptId = toCanonicalUuid(randomUUID())
  const reference = { organizationId: caller.organizationId, userId: caller.userId, receiptId }

  try {
    await reserveBillReceiptForAgent(dataConnect, {
      ...reference,
      membershipCreatedAt: caller.membershipCreatedAt,
      name,
      contentType,
      size: bytes.length,
    })
  } catch (error) {
    if (isOperationRefusal(error, NOT_MEMBER_REFUSAL)) return { outcome: 'notMember' }

    throw error
  }

  await billReceiptStorage.write(buildBillReceiptObjectName(reference), contentType, () =>
    Readable.from([Buffer.from(bytes)]),
  )
  await completeBillReceiptUpload(dataConnect, reference)

  return { outcome: 'written', receiptId }
}

export default writeAgentBillReceipt
